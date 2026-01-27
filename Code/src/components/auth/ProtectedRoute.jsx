import { Navigate, useLocation, Outlet } from 'react-router-dom'
import PropTypes from 'prop-types'
import { authService } from '../../services/authService'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function ProtectedRoute({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isAuthenticated = authService.isAuthenticated()

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true, state: { from: location } })
    }
  }, [isAuthenticated, navigate, location])

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children || <Outlet />
}

ProtectedRoute.propTypes = {
  children: PropTypes.node,
}

export default ProtectedRoute 