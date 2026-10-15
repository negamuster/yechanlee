import { useLocation } from 'react-router-dom'
import { makeReturnOrigin } from '../lib/returnNavigation'
export function useReturnOrigin() {
  const location = useLocation()
  return { returnOrigin: makeReturnOrigin(location, window.history.state?.idx) }
}
