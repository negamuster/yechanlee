import { BrowserRouter, Routes, Route } from 'react-router-dom'
import RouteScroll from './components/RouteScroll'
import Calendar from './pages/Calendar'
import MobileNavigation from './components/MobileNavigation'
import Markets from './pages/Markets'
import More, { LivePage } from './pages/More'
import Saved from './pages/Saved'
import SavedItemsProvider from './components/SavedItemsProvider'
import Home from './pages/00_Home'
import SiteHeader from './components/SiteHeader'
import StockMarket from './pages/01_StockMarket'
import BondMarket from './pages/02_BondMarket'
import Fed from './pages/03_Fed'
import EconomicIndicators from './pages/04_EconomicIndicators'
import GlobalMacro from './pages/05_GlobalMacro'
import Stock from './pages/06_Stock'
import Simulator from './pages/Simulator'
import Form13F from './pages/Form13F'

function App() {
  return (
    <BrowserRouter>
      <SavedItemsProvider>
      <RouteScroll />
      <SiteHeader />
      <Routes>
        <Route path="/markets" element={<Markets />} />
        <Route path="/more" element={<More />} />
        <Route path="/live" element={<LivePage />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/" element={<Home />} />
        <Route path="/equity" element={<StockMarket />} />
        <Route path="/rates" element={<BondMarket />} />
        <Route path="/fed" element={<Fed />} />
        <Route path="/indicators" element={<EconomicIndicators />} />
        <Route path="/macro" element={<GlobalMacro />} />
        <Route path="/stock/:ticker" element={<Stock />} />
        <Route path="/simulator" element={<Simulator />} />
        <Route path="/form13f" element={<Form13F />} />
      </Routes>
      <MobileNavigation />
    </SavedItemsProvider>
    </BrowserRouter>
  )
}

export default App
