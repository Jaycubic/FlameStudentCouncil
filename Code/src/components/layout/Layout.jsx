import { Outlet } from 'react-router-dom'
import { Box, Flex, useColorModeValue } from '@chakra-ui/react'
import Header from './Header'
import Sidebar from './Sidebar'

function Layout() {
  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const glowColor = useColorModeValue(
    'rgba(48, 73, 69, 0.3)',
    'rgba(48, 73, 69, 0.3)'
  )

  return (
    <Flex h="100vh" bg={bgColor} position="relative" overflow="hidden">
      {/* Mesh Gradient Background */}
      <Box
        position="fixed"
        inset="0"
        opacity="0.8"
        bgGradient={useColorModeValue(
          // Light mode mesh
          'radial-gradient(at 20% 20%, rgba(0, 255, 255, 0.15) 0%, transparent 25%), radial-gradient(at 80% 80%, rgba(255, 0, 255, 0.15) 0%, transparent 25%), radial-gradient(at 50% 50%, rgba(0, 128, 255, 0.1) 0%, transparent 30%)',
          // Dark mode mesh
          'radial-gradient(at 20% 20%, rgba(128, 0, 128, 0.2) 0%, transparent 20%), radial-gradient(at 80% 80%, rgba(255, 165, 0, 0.2) 0%, transparent 20%), radial-gradient(at 50% 50%, rgba(75, 0, 130, 0.15) 0%, transparent 25%)'
        )}
        pointerEvents="none"
        zIndex="0"
      />

      {/* Subtle Grid Pattern */}
      <Box
        position="fixed"
        inset="0"
        opacity="0.2"
        backgroundImage={`linear-gradient(${glowColor} 1px, transparent 1px), linear-gradient(to right, ${glowColor} 1px, transparent 1px)`}
        backgroundSize="48px 48px"
        mask="linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)"
        pointerEvents="none"
        zIndex="0"
      />

      {/* Ambient Light Effect */}
      <Box
        position="fixed"
        top="-40%"
        right="-20%"
        width="70%"
        height="70%"
        background={useColorModeValue(
          'radial-gradient(circle, rgba(0, 255, 255, 0.1) 0%, transparent 60%)',
          'radial-gradient(circle, rgba(255, 165, 0, 0.15) 0%, transparent 60%)'
        )}
        filter="blur(80px)"
        transform="rotate(-10deg)"
        pointerEvents="none"
        zIndex="0"
      />

      {/* Main Content */}
      <Sidebar style={{ position: 'relative', zIndex: 10 }} />
      <Box flex="1" overflow="hidden" position="relative" zIndex="1">
        <Header />
        <Box
          as="main"
          h="calc(100vh - 4rem)"
          overflow="auto"
          position="relative"
          css={{
            '&::-webkit-scrollbar': {
              width: '4px',
            },
            '&::-webkit-scrollbar-track': {
              width: '6px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: useColorModeValue('gray.200', 'gray.700'),
              borderRadius: '24px',
            },
          }}
        >
          <Box
            position="relative"
            zIndex="2"
          >
            <Outlet />
          </Box>
        </Box>
      </Box>
    </Flex>
  )
}

export default Layout
