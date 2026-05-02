import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Equity from './pages/Equity'
import Rates from './pages/Rates'
import Treasury from './pages/Treasury'
import Fred from './pages/Fred'
import Macro from './pages/Macro'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/equity" element={<Equity />} />
        <Route path="/rates" element={<Rates />} />
        <Route path="/treasury" element={<Treasury />} />
        <Route path="/fred" element={<Fred />} />
        <Route path="/macro" element={<Macro />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App