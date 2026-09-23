"""Read-only SEC sample collection. Run manually; no API keys required."""
import concurrent.futures, json, pathlib, re, threading, time, urllib.request, sys
root = pathlib.Path('tests/fixtures/sec')
root.mkdir(parents=True, exist_ok=True)
manifest = json.loads((root/'manifest.json').read_text()) if (root/'manifest.json').exists() else {}
lock = threading.Lock()
next_start = 0

def get(url):
    global next_start
    with lock:
        delay = max(0, next_start - time.monotonic())
        time.sleep(delay)
        next_start = time.monotonic() + .3
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Anthracite yechan030102@gmail.com'}), timeout=30) as response:
        text = response.read().decode()
    name = url.split('/')[-1]
    if '/Archives/' in url: name = url.split('/')[-2] + '-' + name
    (root / name).write_text(text)
    with lock: manifest[url] = name
    return text

def collect(cik):
    sub = json.loads(get(f'https://data.sec.gov/submissions/CIK{cik}.json'))
    r = sub['filings']['recent']
    records = [i for i, form in enumerate(r['form']) if form in ['13F-HR','13F-HR/A']]
    periods = sorted(set(r['reportDate'][i] for i in records), reverse=True)[:2]
    for i in records:
        if r['reportDate'][i] not in periods: continue
        accession = r['accessionNumber'][i]
        base = f'https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession.replace("-", "")}'
        primary = r['primaryDocument'][i].split('/')[-1]
        get(f'{base}/{primary}')
        index = get(f'{base}/{accession}-index.htm')
        names = set()
        for row in re.findall(r'<tr\b[^>]*>[\s\S]*?</tr>',index,re.I):
            if 'INFORMATION TABLE' not in row.upper():continue
            names.update(x.split('/')[-1] for x in re.findall(r'href=["\']([^"\']+\.xml)["\']',row,re.I))
        for name in names:
            if name != primary: get(f'{base}/{name}')
    return {'cik':cik,'name':sub['name'],'periods':periods}

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    futures = [pool.submit(collect,cik) for cik in (sys.argv[1:] or ['0001067983','0002026053','0001423053'])]
    for future in concurrent.futures.as_completed(futures):
        try: print(json.dumps(future.result()),flush=True)
        except Exception as error: print(type(error).__name__,str(error),flush=True)
(root/'manifest.json').write_text(json.dumps(manifest,indent=2))
