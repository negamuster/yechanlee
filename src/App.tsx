import RouteLoadBoundary from './components/RouteLoadBoundary'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import RouteScroll from './components/RouteScroll'
const Calendar = lazy(() => import('./pages/Calendar'))
import MobileNavigation from './components/MobileNavigation'
const Markets = lazy(() => import('./pages/Markets'))
const More = lazy(() => import('./pages/More'))
const LivePage = lazy(() => import('./pages/More').then(module => ({ default: module.LivePage })))
const Saved = lazy(() => import('./pages/Saved'))
import SavedItemsProvider from './components/SavedItemsProvider'
import Home from './pages/00_Home'
import SiteHeader from './components/SiteHeader'
const StockMarket = lazy(() => import('./pages/01_StockMarket'))
const BondMarket = lazy(() => import('./pages/02_BondMarket'))
const Fed = lazy(() => import('./pages/03_Fed'))
const EconomicIndicators = lazy(() => import('./pages/04_EconomicIndicators'))
const GlobalMacro = lazy(() => import('./pages/05_GlobalMacro'))
const Stock = lazy(() => import('./pages/06_Stock'))
const Simulator = lazy(() => import('./pages/Simulator'))
const Form13F = lazy(() => import('./pages/Form13F'))

function App() {
  return (
    <BrowserRouter>
      <SavedItemsProvider>
      <RouteScroll />
      <SiteHeader />
      <RouteLoadBoundary><Suspense fallback={<main className="route-loading" role="status">페이지를 불러오는 중…</main>}>
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
      </Suspense></RouteLoadBoundary>
      <MobileNavigation />
    </SavedItemsProvider>
    </BrowserRouter>
  )
}

export default App
