# Navigation and market guides

The shared header exposes all five market pages plus the two investment tools from every route, with mobile expansion, active-page links, keyboard focus, Escape closing, and a ticker search. The long home footer menu is removed.

Market pages now lead with a short purpose, available quotes or official source links, then expandable reading notes. Equity and macro reuse /api/market-indices; the quote timestamps and delayed-data label remain visible. Rates, Fed and economic indicators provide official external data/chart/calendar links rather than inventing unconnected current readings or forecasts. This first pass does not add sector breadth, consensus, embedded yield curves or scenario comparison engines.

The Nasdaq 100 link now points to ^NDX, and the NASDAQ snapshot is explicitly identified as the Composite. Form 13F separates reportDate from filingDate, including missing values, and labels unavailable previous holdings as unknown instead of new positions. Existing 13F-HR selection still does not consolidate amendments; the existing top-30 view is retained. Simulator copy describes the existing annual net-asset calculation and its assumptions; its numerical model is unchanged.

Sources checked while editing:
- https://www.sec.gov/files/form13f.pdf
- https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
- https://www.bea.gov/data/gdp/gross-domestic-product
- https://fred.stlouisfed.org/series/DGS10

Validation: TypeScript/production build and two mocked SEC retrieval tests covering distinct dates, missing report dates and failed previous-period comparison. No browser screenshot or live SEC portfolio verification was performed in this pass.
