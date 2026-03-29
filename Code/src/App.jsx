// src/App.jsx
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
const AwardForm = lazy(() => import('./pages/AwardForm'))
const Profile = lazy(() => import('./pages/Profile'))
const Settings = lazy(() => import('./pages/Settings'))
const TimeManagement = lazy(() => import('./pages/TimeManagement'))
const ApplicantsView = lazy(() => import('./pages/ApplicantsView'))

// Theme configuration
const theme = extendTheme({
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
  fontSizes: {
    '2xs': 'clamp(0.625rem, 0.55rem + 0.25vw, 0.75rem)',   // 10px → 12px
    xs: 'clamp(0.7rem, 0.625rem + 0.3vw, 0.8rem)',       // 11.2px → 12.8px
    sm: 'clamp(0.8rem, 0.725rem + 0.35vw, 0.9rem)',      // 12.8px → 14.4px
    md: 'clamp(0.875rem, 0.8rem + 0.4vw, 1rem)',         // 14px → 16px
    lg: 'clamp(1rem, 0.9rem + 0.5vw, 1.25rem)',          // 16px → 20px
    xl: 'clamp(1.15rem, 1rem + 0.65vw, 1.5rem)',         // 18.4px → 24px
    '2xl': 'clamp(1.35rem, 1.15rem + 0.85vw, 1.875rem)',   // 21.6px → 30px
    '3xl': 'clamp(1.6rem, 1.3rem + 1.1vw, 2.25rem)',       // 25.6px → 36px
    '4xl': 'clamp(1.875rem, 1.5rem + 1.3vw, 2.75rem)',     // 30px → 44px
    '5xl': 'clamp(2.25rem, 1.75rem + 1.6vw, 3.5rem)',      // 36px → 56px
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
                <Route path="/time-management" element={<TimeManagement />} />
                <Route path="/applicants" element={<ApplicantsView />} />
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
