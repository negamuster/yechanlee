import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Home from './pages/00_Home'
import StockMarket from './pages/01_StockMarket'
import BondMarket from './pages/02_BondMarket'
import Fed from './pages/03_Fed'
import EconomicIndicators from './pages/04_EconomicIndicators'
import GlobalMacro from './pages/05_GlobalMacro'
import Simulator from './pages/Simulator'
import Form13F from './pages/Form13F'


function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/equity" element={<StockMarket />} />
        <Route path="/rates" element={<BondMarket />} />
        <Route path="/fed" element={<Fed />} />
        <Route path="/indicators" element={<EconomicIndicators />} />
        <Route path="/macro" element={<GlobalMacro />} />
        <Route path="/simulator" element={<Simulator />} />
        <Route path="/form13f" element={<Form13F />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App