import { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import {
  ChakraProvider,
  ColorModeScript,
  Spinner,
  Center,
  extendTheme
} from '@chakra-ui/react'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Login from './pages/Login'
import NotFound from './pages/NotFound'

// Lazy load components
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Users = lazy(() => import('./pages/Users'))
const Roles = lazy(() => import('./pages/StudentInfoTable'))
const AwardForm = lazy(() => import('./pages/AwardForm'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Profile = lazy(() => import('./pages/Profile'))
const Departments = lazy(() => import('./pages/StudentHouseTracking'))
const EmployeeDashboard = lazy(() => import('./pages/EmployeeDashboard'))
const Settings = lazy(() => import('./pages/Settings'))
const ParentInfo = lazy(() => import('./pages/ParentInfo'))
const TrackingInfo = lazy(() => import('./pages/TrackingInfo'))
const QueueDashboard = lazy(() => import('./pages/QueueDashboard'))
const QueueGrabber = lazy(() => import('./pages/QueueGrabber'))
const DeclarationForm = lazy(() => import('./pages/DeclarationForm'))
const ReportDay = lazy(() => import('./pages/ReportDay'))
const QueueCounterDashboard = lazy(() => import('./pages/QueueCounterDashboard'))
const StudentStatus = lazy(() => import('./pages/StudentStatusTracking'))

// Theme configuration
const theme = extendTheme({
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
  colors: {
    vrv: {
      50: '#e9efee',
      100: '#c8d5d3',
      200: '#a4bab7',
      300: '#809e9a',
      400: '#5c837e',
      500: '#304945',
      600: '#243634',
      700: '#182423',
      800: '#0c1211',
      900: '#000000',
    },
  },
  fonts: {
    heading: '"Space Grotesk", sans-serif',
    body: '"Space Grotesk", sans-serif',
  },
})

// Loading fallback component
const LoadingFallback = () => (
  <Center h="100vh">
    <Spinner size="xl" color="vrv.500" thickness="4px" />
  </Center>
)

function App() {
  return (
    <>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <ChakraProvider theme={theme}>
        <Router>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route path="/declaration-form" element={<DeclarationForm />} />
                <Route path="/users" element={<Users />} />
                <Route path="/roles" element={<Roles />} />
                <Route path="/award-form" element={<AwardForm />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/departments" element={<Departments />} />
                <Route path="/parentsinfo" element={<ParentInfo />} />
                <Route path="/trackinginfo" element={<TrackingInfo />} />
                <Route path="/employee" element={<EmployeeDashboard />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/queue-dashboard" element={<QueueDashboard />} />
                <Route path="/queue-grabber" element={<QueueGrabber />} />
                <Route path="/report-day" element={<ReportDay />} />
                <Route path="/report-day-dashboard" element={<QueueCounterDashboard />} />
                <Route path="/studentStatus" element={<StudentStatus />} />
                <Route path="/" element={<Dashboard />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Router>
      </ChakraProvider>
    </>
  )
}

export default App
