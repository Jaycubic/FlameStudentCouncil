/* eslint-disable react/prop-types */
import { NavLink, useNavigate } from 'react-router-dom'

import {
  Box,
  VStack,
  Flex,
  Text,
  Icon,
  Image,
  Divider,
  useColorModeValue,
  Drawer,
  DrawerContent,
  DrawerOverlay,
  DrawerCloseButton,
  IconButton,
  useDisclosure,
  Tooltip,
  useBreakpointValue,
} from '@chakra-ui/react'

import {
  HomeIcon,
  UserGroupIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon,
  CalendarIcon,
  Bars3Icon,
  BuildingOfficeIcon,
  UserIcon,
  AcademicCapIcon,
  MapPinIcon,
  UsersIcon,
  IdentificationIcon,
  QueueListIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline'

import { authService } from '../../services/authService'

import { useState, useRef } from 'react'
import { Portal } from '@chakra-ui/react'

import Logo from '../../assets/img/FLAME.png' // Import the logo

function Sidebar() {
  const navigate = useNavigate()
  const user = authService.getCurrentUser()

  if (!user) {
    return (
      <Box textAlign="center" p={4}>
        <Text color="red.500">User not logged in. Please log in to access the sidebar.</Text>
      </Box>
    )
  }

  const { isOpen, onOpen, onClose } = useDisclosure()
  const isDesktop = useBreakpointValue({ base: false, md: true })
  const [isCollapsed, setIsCollapsed] = useState(isDesktop)
  const timeoutRef = useRef(null)

  // Refs for container
  const containerRef = useRef(null)

  // Responsive values (using explicit px values to avoid unexpected token spacing)
  const sidebarWidth = useBreakpointValue({ base: '64px', md: '220px', lg: '240px' }) // Non-collapsed width
  const collapsedWidth = useBreakpointValue({ base: '64px', md: '64px', lg: '72px' })
  const iconSize = useBreakpointValue({ base: '20px', md: '20px', lg: '24px' })
  const fontSize = useBreakpointValue({ base: '12px', md: '14px' })
  const spacing = useBreakpointValue({ base: 1, md: 2, lg: 3 })
  const logoSize = useBreakpointValue({ base: '36px', md: '64px', lg: '72px' })
  const borderRadius = useBreakpointValue({ base: '20px', md: '24px' })
  const paddingX = useBreakpointValue({ base: 2, md: 3, lg: 4 })
  const margin = useBreakpointValue({ base: 3, md: 4, lg: 6 })

  // Gradient palettes
  const bgGradient = useColorModeValue(
    'linear-gradient(135deg, #1e40af 0%, #2563eb 100%, #38bdf8 50%)',
    'linear(to-b, purple.700, pink.500)'
  )
  const borderColor = useColorModeValue('blue.800', 'pink.600')
  const activeItemBg = useColorModeValue(
    'linear(to-r, blue.500, blue.400)',
    'linear(to-r, purple.600, pink.400)'
  )
  const hoverBg = useColorModeValue(
    'linear(to-r, blue.300, blue.200)',
    'linear(to-r, purple.500, pink.300)'
  )
  const secondaryTextColor = useColorModeValue('whiteAlpha.700', 'whiteAlpha.700')
  const textColor = useColorModeValue('white', 'white')
  const iconColor = useColorModeValue('white', 'white')
  const activeTextColor = useColorModeValue('white', 'white')
  const activeIconColor = useColorModeValue('white', 'white')
  const activeIndicatorColor = useColorModeValue('white', 'white')

  const allNavigation = [
    { name: 'Dashboard', href: '/', icon: HomeIcon, roles: ['admin', 'Student', 'user', 'Council', 'AdminLite'] },
    { name: 'StudentInfo', href: '/roles', icon: AcademicCapIcon, roles: ['admin', 'Student', 'Council', 'user', 'AdminLite'] },
    { name: 'Student Housing', href: '/departments', icon: BuildingOfficeIcon, roles: ['admin', 'Student', 'user', 'Council', 'AdminLite'] },
    { name: 'Parent Info', href: '/parentsinfo', icon: UsersIcon, roles: ['admin', 'Student', 'user', 'Council', 'AdminLite'] },
    { name: 'Tracking Info', href: '/trackinginfo', icon: MapPinIcon, roles: ['admin', 'Student', 'user', 'Council', 'AdminLite'] },
    { name: 'StudentStatus', href: '/studentStatus', icon: BuildingOfficeIcon, roles: ['admin', 'Student', 'user', 'AdminLite'] },
    { name: 'Declaration Form', href: '/declaration-form', icon: UserGroupIcon, roles: ['admin', 'Council'] },
    { name: 'IDcard generation', href: '/analytics', icon: IdentificationIcon, roles: ['admin', 'AdminLite'] },
    { name: 'Queue Management', href: '/calendar', icon: QueueListIcon, roles: ['admin', 'AdminLite'] },
    { name: 'Users', href: '/users', icon: UserGroupIcon, roles: ['admin'] },
    { name: 'Queue Dashboard', href: '/queue-dashboard', icon: ChartBarIcon, roles: ['user'] },
    { name: 'Queue Grabber', href: '/queue-grabber', icon: QueueListIcon, roles: ['user'] },
    { name: 'Report Day', href: '/report-day', icon: ClipboardDocumentIcon, roles: ['admin', 'AdminLite', 'user'] },
    { name: 'Report Day Dashboard', href: '/report-day-dashboard', icon: ChartBarIcon, roles: ['admin', 'AdminLite', 'user'] },
    { name: 'Documentation & License', href: '/profile', icon: QueueListIcon, roles: ['admin', 'Student', 'user', 'AdminLite', 'Council'] },
  ]

  const mainNavigation = user?.role
    ? allNavigation.filter(item => item.roles.includes(user.role))
    : [
        { name: 'Home', href: '/', icon: HomeIcon, roles: [] },
      ];

  const secondaryNavigation = user?.role
    ? [
        { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, roles: ['admin'] },
        { name: 'Logout', href: '#', icon: ArrowLeftOnRectangleIcon, onClick: () => { authService.logout(); navigate('/login') }, roles: ['admin', 'Student', 'user'] },
      ].filter(item => item.roles.includes(user.role))
    : [];

  const SidebarContent = ({ onClose: onDrawerClose = () => {}, isMobile = false }) => (
    <Box
      ref={containerRef}
      bgGradient={bgGradient}
      backdropFilter="blur(12px)"
      color="white"
      py={spacing}
      px={isCollapsed && !isMobile ? 2 : paddingX}
      position="relative"
      transition="all 0.28s ease-in-out"
      w={isCollapsed && !isMobile ? collapsedWidth : sidebarWidth}
      borderRadius={borderRadius}
      boxShadow="xl"
      border="1px solid"
      borderColor={borderColor}
      onMouseEnter={!isMobile ? () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setIsCollapsed(false)
      } : undefined}
      onMouseLeave={!isMobile ? () => {
        timeoutRef.current = setTimeout(() => {
          setIsCollapsed(true)
        }, 1000)
      } : undefined}
      // Set height to 100% to inherit from parent and fit perfectly
      h="100%"
      // Enable auto vertical scroll with hidden scrollbar and smooth behavior
      overflowY="auto"
      overflowX="hidden"
      sx={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
      css={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}
    >
      {/* Content */}
      <Flex direction="column" minH="full">
        {/* Logo */}
        <Flex
          justify="center"
          align="center"
          mb={2} 
          overflow="hidden"
          transition="all 0.2s ease-in-out"
        >
          <Image
            boxSize={isCollapsed && !isMobile ? '32px' : logoSize} // Slightly smaller logo
            src={Logo}
            alt="FLAME Logo"
            fallbackSrc="https://via.placeholder.com/80"
            bg="white"
            borderRadius="lg"
            objectFit="contain"
            transition="transform 0.2s ease-in-out"
            _hover={{ transform: "scale(1.04)" }}
          />
        </Flex>

        {/* Navigation */}
        <VStack spacing={1} align='stretch' flex="1" minH={0}> {/* Reduced spacing from variable to 1 */}
          {!(isCollapsed && !isMobile) && <Text fontSize="2xs" color={secondaryTextColor} textTransform="uppercase" letterSpacing="wider" mb={1} textAlign="center">Main Menu</Text>}

          <Box>
            {mainNavigation.map(item => (
              <NavItem 
                key={item.name} 
                item={item} 
                onClose={onDrawerClose} 
                activeItemBg={activeItemBg} 
                hoverBg={hoverBg} 
                isCollapsed={isCollapsed && !isMobile} 
                iconSize={iconSize} 
                fontSize={fontSize} 
                textColor={textColor} 
                iconColor={iconColor}
                activeTextColor={activeTextColor}
                activeIconColor={activeIconColor}
                activeIndicatorColor={activeIndicatorColor}
              />
            ))}
          </Box>

          <Box mt="auto">
            <Divider my={spacing} borderColor={borderColor} opacity="0.5" />
            {!(isCollapsed && !isMobile) && <Text fontSize="xs" color={secondaryTextColor} textTransform="uppercase" letterSpacing="wider" mb={spacing}>System</Text>}
            {secondaryNavigation.map(item => (
              <NavItem 
                key={item.name} 
                item={item} 
                isSecondary 
                onClose={onDrawerClose} 
                activeItemBg={activeItemBg} 
                hoverBg={hoverBg} 
                isCollapsed={isCollapsed && !isMobile} 
                iconSize={iconSize} 
                fontSize={fontSize} 
                textColor={textColor} 
                iconColor={iconColor}
                activeTextColor={activeTextColor}
                activeIconColor={activeIconColor}
                activeIndicatorColor={activeIndicatorColor}
              />
            ))}
          </Box>
        </VStack>
      </Flex>
    </Box>
  )

  const NavItem = ({ item, isSecondary = false, onClose, activeItemBg, hoverBg, isCollapsed, iconSize, fontSize, textColor, iconColor, activeTextColor, activeIconColor, activeIndicatorColor }) => {
    if (item.onClick) {
      return (
        <Box as="button" w="full" onClick={() => { item.onClick(); onClose?.(); }} className="transition">
          <NavItemContent 
            item={item} 
            isActive={false} 
            isCollapsed={isCollapsed} 
            hoverBg={hoverBg} 
            isSecondary={isSecondary} 
            iconSize={iconSize} 
            fontSize={fontSize} 
            textColor={textColor} 
            iconColor={iconColor} 
            activeTextColor={activeTextColor}
            activeIconColor={activeIconColor}
          />
        </Box>
      )
    }

    return (
      <NavLink to={item.href} className="w-full transition" onClick={() => onClose?.()}>
        {({ isActive }) => (
          <Box
            bgGradient={isActive ? activeItemBg : 'transparent'}
            position="relative"
            transition="all 0.2s ease-in-out"
            _before={isActive ? {
              content: '""',
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              bg: activeIndicatorColor,
              borderRadius: 'full',
              transition: 'all 0.2s ease-in-out',
              ...(isCollapsed ? {
                left: 'auto',
                right: '-2px',
                width: '8px',
                height: '8px',
              } : {
                left: '0',
                width: '4px',
                height: '70%',
              })
            } : {}}
          >
            <NavItemContent 
              item={item} 
              isActive={isActive} 
              isCollapsed={isCollapsed} 
              hoverBg={hoverBg} 
              isSecondary={isSecondary} 
              iconSize={iconSize} 
              fontSize={fontSize} 
              textColor={textColor} 
              iconColor={iconColor} 
              activeTextColor={activeTextColor}
              activeIconColor={activeIconColor}
            />
          </Box>
        )}
      </NavLink>
    )
  }

  const NavItemContent = ({ item, isActive, isCollapsed, hoverBg, isSecondary, iconSize, fontSize, textColor, iconColor, activeTextColor, activeIconColor }) => (
    <Tooltip label={isCollapsed ? item.name : ''} placement="right">
      <Flex
        align="center"
        justify={isCollapsed ? 'center' : 'flex-start'}
        px={isCollapsed ? 2 : 3}
        py={2}
        rounded={isCollapsed ? 'full' : 'md'}
        transition="all 0.18s ease-in-out"
        _hover={{ bgGradient: hoverBg, transform: isCollapsed ? 'none' : 'translateX(6px)' }}
        opacity={isSecondary ? 0.9 : 1}
        whiteSpace="nowrap"
        overflow="hidden"
      >
        <Icon as={item.icon} boxSize={iconSize} color={isActive ? activeIconColor : iconColor} transition="all 0.18s ease-in-out" />
        {!isCollapsed && <Text ml={3} fontSize={fontSize} fontWeight={isActive ? "bold" : "medium"} color={isActive ? activeTextColor : textColor} transition="all 0.18s ease-in-out" textOverflow="ellipsis" overflow="hidden">{item.name}</Text>}
      </Flex>
    </Tooltip>
  )
const MobileMenuButton = () => (
  <Portal>
    <IconButton
      display={{ base: 'flex', md: 'none' }}
      onClick={onOpen}
      variant="ghost"
      position="fixed"
      top="50px"           // use px/rem for exact placement
      left="16px"          // left="4" maps to theme space; you can use "16px" if you want exact
      zIndex="13"          // or higher if needed, can also use "9999"
      icon={<Bars3Icon className="h-6 w-6" color={useColorModeValue('black', 'white')} />} // Adjusted color for light and dark modes
      aria-label="Open menu"
      color="black"
      _hover={{ bgGradient: useColorModeValue('linear(to-r, blue.300, blue.200)', 'linear(to-r, purple.500, pink.300)') }}
    />
  </Portal>
)
  return (
    <>
      <MobileMenuButton />
      <Box 
        as="aside" 
        transition="all 0.2s" 
        w={isCollapsed ? collapsedWidth : sidebarWidth} 
        display={{ base: 'none', md: 'block' }} 
        m={margin}
        // Make the outer box exactly fit the viewport height so inner scaling works predictably
        h="calc(100vh - 2 * var(--chakra-space-4))"
        // Ensure no horizontal overflow, vertical handled inside
        overflow="hidden"
      >
        <SidebarContent />
      </Box>

      {/* Mobile Drawer */}
      <Box display={{ base: 'block', md: 'none' }}>
        <Drawer isOpen={isOpen} placement="left" onClose={onClose} size="md">
          <DrawerOverlay />
          <DrawerContent bg="transparent" pt={margin} pb={margin} pl={margin}>
            <DrawerCloseButton color="white" />
            <SidebarContent onClose={onClose} isMobile={true} />
          </DrawerContent>
        </Drawer>
      </Box>
    </>
  )
}

export default Sidebar