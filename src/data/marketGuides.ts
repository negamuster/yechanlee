export const marketGuides = {
  "equity": {
    "title": "주식시장",
    "description": "주요 지수의 움직임을 비교하고, 시장을 구성하는 기업과 업종의 차이를 살펴봅니다.",
    "symbols": [
      "^GSPC",
      "^IXIC",
      "^KS11",
      "^N225"
    ],
    "links": [
      [
        "S&P 500 차트",
        "https://finance.yahoo.com/quote/%5EGSPC/"
      ],
      [
        "Nasdaq 100 차트",
        "https://finance.yahoo.com/quote/%5ENDX/"
      ],
      [
        "KOSPI 차트",
        "https://finance.yahoo.com/quote/%5EKS11/"
      ]
    ],
    "sections": [
      [
        "지수부터 비교하기",
        "S&P 500은 미국 대형주, Nasdaq 100은 나스닥의 대형 비금융 기업을 살펴보는 지수입니다. 상단의 NASDAQ 시세는 나스닥 종합지수로, Nasdaq 100과 구성 범위가 다릅니다.",
        "같은 기간의 등락률을 비교하고, 일부 대형 종목이 지수 움직임을 주도하는지도 확인하세요."
      ],
      [
        "국가별 시장 읽기",
        "KOSPI, Nikkei 225, Hang Seng 등은 구성 기업과 산출 방식이 다릅니다. 각 지수는 현지 시장과 통화 기준으로 읽어야 합니다.",
        "거래시간과 환율이 달라 단순 등락률 비교가 투자자의 실제 수익률과 같지는 않습니다."
      ],
      [
        "시장 참여의 폭 확인하기",
        "지수 상승만으로 시장 전체가 강하다고 판단하기는 어렵습니다. 업종별 등락과 상승·하락 종목 수를 함께 살펴보세요.",
        "현재 화면은 주요 지수 시세를 제공합니다. 업종별 수익률과 시장 폭 데이터는 아직 연결하지 않았습니다."
      ]
    ]
  },
  "rates": {
    "title": "금리·채권",
    "description": "국채금리와 수익률곡선으로 금리 환경을 살펴봅니다. 최신 수치와 차트는 아래 공식 자료에서 확인할 수 있습니다.",
    "symbols": [],
    "links": [
      [
        "미국 2년물 · FRED",
        "https://fred.stlouisfed.org/series/DGS2"
      ],
      [
        "미국 10년물 · FRED",
        "https://fred.stlouisfed.org/series/DGS10"
      ],
      [
        "만기별 금리 · 미 재무부",
        "https://home.treasury.gov/resource-center-data-chart-center/interest-rates"
      ],
      [
        "10년−2년 금리차",
        "https://fred.stlouisfed.org/series/T10Y2Y"
      ]
    ],
    "sections": [
      [
        "금리 수준과 변화 구분하기",
        "2년물과 10년물 금리를 함께 보고, 전일·전월 대비 변화를 비교합니다. 금리 변화는 %와 퍼센트포인트를 구분해야 합니다.",
        "1bp는 0.01%포인트입니다. 4.00%에서 4.10%로 상승하면 10bp 상승입니다."
      ],
      [
        "수익률곡선의 모양 읽기",
        "만기별 금리를 연결하면 수익률곡선이 됩니다. 기울기 변화는 단기와 장기 금리 중 어느 쪽이 움직였는지 나누어 해석합니다.",
        "곡선이 가팔라졌다는 사실만으로 경기 회복이나 침체를 단정하지 마세요."
      ],
      [
        "신용 위험과 실질금리 함께 보기",
        "회사채의 국채 대비 금리차와 물가연동국채 금리를 함께 확인하면 다른 위험 요인을 구분하는 데 도움이 됩니다.",
        "신용 스프레드는 신용 위험뿐 아니라 유동성의 영향도 받습니다."
      ]
    ]
  },
  "fed": {
    "title": "연준·통화정책",
    "description": "연준의 결정과 발표 자료를 통해 통화정책의 변화를 살펴봅니다. 회의 일정과 성명은 공식 원문에서 확인하세요.",
    "symbols": [],
    "links": [
      [
        "FOMC 일정·성명·기자회견",
        "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"
      ],
      [
        "목표금리 상단 · FRED",
        "https://fred.stlouisfed.org/series/DFEDTARU"
      ],
      [
        "목표금리 하단 · FRED",
        "https://fred.stlouisfed.org/series/DFEDTARL"
      ],
      [
        "연준 대차대조표",
        "https://www.federalreserve.gov/releases/h41/"
      ]
    ],
    "sections": [
      [
        "결정과 전망 구분하기",
        "현재 목표금리 범위와 이번 회의의 변경 내용을 먼저 확인합니다. 경제전망과 점도표는 확정된 정책 경로가 아닙니다.",
        "이전 성명과 비교해 바뀐 표현을 찾고, 기자회견의 조건부 설명을 함께 읽어보세요."
      ],
      [
        "발표 순서 확인하기",
        "회의 일정 페이지에서 성명, 기자회견, 의사록 등 공개 자료를 확인할 수 있습니다. 자료마다 발표 시점이 다릅니다.",
        "문서의 발표일과 회의일을 구분하고, 최신 결정과 과거 발언을 섞어 읽지 않도록 주의하세요."
      ],
      [
        "금리와 대차대조표 나누어 보기",
        "정책금리 조정과 자산 보유 규모 변화는 서로 다른 수단입니다. 금리 수준과 대차대조표 흐름을 따로 확인합니다.",
        "하나의 수치만으로 금융 여건 전체가 완화되거나 긴축됐다고 단정하지 마세요."
      ]
    ]
  },
  "indicators": {
    "title": "경제지표",
    "description": "물가·고용·성장 지표가 이전보다 어떻게 달라졌는지 확인합니다. 발표치의 대상 기간과 수정 여부도 함께 살펴보세요.",
    "symbols": [],
    "links": [
      [
        "물가 · BLS CPI",
        "https://www.bls.gov/cpi/"
      ],
      [
        "고용 · BLS Employment Situation",
        "https://www.bls.gov/news.release/empsit.toc.htm"
      ],
      [
        "성장 · BEA GDP",
        "https://www.bea.gov/data/gdp/gross-domestic-product"
      ],
      [
        "발표 일정 · BLS",
        "https://www.bls.gov/schedule/"
      ]
    ],
    "sections": [
      [
        "성장: 증가율의 기준 확인",
        "GDP를 비교할 때는 실질·명목, 전분기·전년동기, 연율화 여부를 먼저 확인합니다. 발표 후 수치가 수정될 수 있습니다.",
        "서로 다른 증가율 기준을 직접 비교하지 말고, 속보치와 수정치도 구분하세요."
      ],
      [
        "물가: 수준과 상승률 구분",
        "CPI 등 물가 지표는 지수 수준과 상승률을 구분해 읽습니다. 전월 대비와 전년 동월 대비 수치는 서로 다른 질문에 답합니다.",
        "물가상승률 둔화가 곧 가격 수준의 하락을 의미하지는 않습니다."
      ],
      [
        "고용: 한 숫자보다 여러 지표",
        "고용 증감과 실업률, 경제활동참가율, 이전 발표의 수정치를 함께 확인합니다. 지표별 조사 대상과 산출 방식이 다릅니다.",
        "예상치 비교는 출처와 집계 시점이 확인된 경우에만 사용하세요. 이 페이지는 컨센서스를 제공하지 않습니다."
      ]
    ]
  },
  "macro": {
    "title": "글로벌 매크로",
    "description": "달러·원자재·시장 변동성을 함께 보며 글로벌 금융 환경의 변화를 살펴봅니다.",
    "symbols": [
      "DX-Y.NYB",
      "GC=F",
      "CL=F",
      "^VIX"
    ],
    "links": [
      [
        "달러지수 차트",
        "https://finance.yahoo.com/quote/DX-Y.NYB/"
      ],
      [
        "금 선물 차트",
        "https://finance.yahoo.com/quote/GC%3DF/"
      ],
      [
        "WTI 선물 차트",
        "https://finance.yahoo.com/quote/CL%3DF/"
      ],
      [
        "VIX · Cboe",
        "https://www.cboe.com/tradable_products/vix/"
      ]
    ],
    "sections": [
      [
        "달러와 국가별 시장",
        "달러지수와 주요국 주식시장을 함께 비교하되, 금리·성장·정책 등 가능한 배경을 나누어 살펴봅니다.",
        "달러지수는 원/달러 환율과 다릅니다. 특정 국가의 환율 움직임을 그대로 대표하지 않습니다."
      ],
      [
        "원자재: 수요와 공급 구분",
        "금과 원유는 서로 다른 수급 요인의 영향을 받습니다. 가격 방향과 함께 공급 차질, 수요 변화, 환율을 확인합니다.",
        "표시된 금·원유 가격은 선물입니다. 현물 가격과 다르며 계약 교체의 영향이 있을 수 있습니다."
      ],
      [
        "변동성: 방향 예측과 구분",
        "VIX는 S&P 500 옵션 가격에서 산출되는 기대 변동성 지표입니다. 주가의 상승·하락 방향 자체를 예측하는 수치는 아닙니다.",
        "여러 자산이 함께 움직였더라도 그것만으로 원인과 결과가 확인된 것은 아닙니다."
      ]
    ]
  }
} as const
export type GuideId = keyof typeof marketGuides
