// src/components/layout/Sidebar.jsx
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
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
  MoonIcon,
  DocumentCheckIcon,
  PencilSquareIcon,
  DocumentTextIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline'
import { authService } from '../../services/authService'
import { useState, useRef } from 'react'
import { Portal } from '@chakra-ui/react'
import Logo from '../../assets/img/FLAME.png'
// Curved Selector Component with organic rounded right corners
const ActiveSelector = ({ isActive, isCollapsed }) => {
  if (!isActive) return null;
  if (isCollapsed) {
    // Circular selector for collapsed state
    return (
      <Box
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        width="40px"
        height="40px"
        zIndex="0"
        borderRadius="full"
        bg="white"
        boxShadow="0px 8px 24px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.15)"
        backdropFilter="blur(20px)"
        transition="all 0.24s ease-out"
        _before={{
          content: '""',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '36px',
          height: '36px',
          borderRadius: 'full',
          border: '2px solid',
          borderColor: useColorModeValue('blue.200', 'purple.200'),
          boxShadow: 'inset 0 0 20px rgba(255,255,255,0.5)',
        }}
      />
    );
  }
  return (
    <Box
      position="absolute"
      top="0"
      left="0"
      right="0"
      bottom="0"
      zIndex="0"
      borderRadius="full"
      bg="white"
      boxShadow="0px 8px 24px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.15)"
      backdropFilter="blur(20px)"
      transition="all 0.24s ease-out"
    />
  );
};
// Compact NavItem Content
const NavItemContent = ({ item, isActive, isCollapsed, iconSize, fontSize, isSecondary }) => {
  const textColor = useColorModeValue('whiteAlpha.900', 'whiteAlpha.900');
  const iconColor = useColorModeValue('whiteAlpha.900', 'whiteAlpha.900');
  const activeTextColor = useColorModeValue('blue.700', 'purple.700');
  const activeIconColor = useColorModeValue('blue.700', 'purple.700');

  return (
    <Flex
      align="center"
      justify={isCollapsed ? 'center' : 'flex-start'}
      px={isCollapsed ? 0 : 3}
      py={2}
      rounded="lg"
      transition="all 0.24s ease-out"
      transform={isActive ? 'scale(1.02)' : 'scale(1)'}
      _hover={{
        transform: isCollapsed ? 'scale(1.08)' : 'scale(1.04)',
        bg: isActive ? 'transparent' : 'whiteAlpha.100',
      }}
      opacity={isSecondary ? 0.9 : 1}
      whiteSpace="nowrap"
      overflow="hidden"
      position="relative"
      zIndex="1"
      cursor="pointer"
      minH="40px"
    >
      <Icon
        as={item.icon}
        boxSize={iconSize}
        color={isActive ? activeIconColor : iconColor}
        transition="all 0.24s ease-out"
        strokeWidth={isActive ? 2.2 : 1.8}
        zIndex="1"
      />
      {!isCollapsed && (
        <Text
          ml={3}
          fontSize={fontSize}
          fontWeight={isActive ? "bold" : "medium"}
          color={isActive ? activeTextColor : textColor}
          transition="all 0.24s ease-out"
          textOverflow="ellipsis"
          overflow="hidden"
          letterSpacing={isActive ? '0.02em' : 'normal'}
          zIndex="1"
        >
          {item.name}
        </Text>
      )}
    </Flex>
  );
};
function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = authService.getCurrentUser()

  if (user?.role === 'Student') return null;
  const { isOpen, onOpen, onClose } = useDisclosure()
  const isDesktop = useBreakpointValue({ base: false, md: true })
  const [isCollapsed, setIsCollapsed] = useState(isDesktop)
  const timeoutRef = useRef(null)

  const containerRef = useRef(null)

  // Responsive values
  const sidebarWidth = useBreakpointValue({ base: '64px', md: '200px', lg: '220px' }) // Slightly narrower
  const collapsedWidth = useBreakpointValue({ base: '64px', md: '64px', lg: '68px' })
  const iconSize = useBreakpointValue({ base: '20px', md: '20px', lg: '22px' })
  const fontSize = useBreakpointValue({ base: '12px', md: '13px' }) // Slightly smaller
  const spacing = useBreakpointValue({ base: 1, md: 1.5, lg: 2 }) // Reduced spacing
  const logoSize = useBreakpointValue({ base: '32px', md: '48px', lg: '56px' }) // Smaller logo
  const paddingX = useBreakpointValue({ base: 1, md: 2, lg: 3 }) // Reduced padding
  const margin = useBreakpointValue({ base: 3, md: 4, lg: 6 })

  // Glassmorphism background
  const sidebarBg = useColorModeValue(
    'linear-gradient(135deg, rgba(30, 58, 138, 0.98) 0%, rgba(59, 130, 246, 0.98) 100%)',
    'linear-gradient(135deg, rgba(88, 28, 135, 0.98) 0%, rgba(236, 72, 153, 0.98) 100%)'
  )

  const borderColor = useColorModeValue('blue.800/30', 'pink.600/30')

  const allNavigation = [
    { name: 'Dashboard',   href: '/',            icon: HomeIcon,           roles: ['admin', 'RC', 'user', 'Council', 'AdminLite'] },
    { name: 'Applicants',  href: '/applicants',  icon: TableCellsIcon,     roles: ['admin'] },
    { name: 'Time & Title',href: '/time-management', icon: CalendarIcon,   roles: ['admin'] },
    { name: 'Award Form',  href: '/award-form',  icon: IdentificationIcon, roles: ['Student'] },
    { name: 'Settings',    href: '/settings',    icon: Cog6ToothIcon,      roles: ['admin'] },
  ]

  const mainNavigation = allNavigation.filter(item => item.roles.includes(user?.role))
  const secondaryNavigation = [
    { name: 'Logout', href: '#', icon: ArrowLeftOnRectangleIcon, onClick: () => { authService.logout(); navigate('/login') }, roles: ['admin', 'RC', 'user'] },
  ].filter(item => item.roles.includes(user?.role))

  // NavItem Component
  const NavItem = ({ item, isSecondary = false, onClose, isCollapsed, iconSize, fontSize }) => {
    const location = useLocation()
    const isActive = location.pathname === item.href

    if (item.onClick) {
      return (
        <Box
          as="button"
          w="full"
          onClick={() => { item.onClick(); onClose?.(); }}
          position="relative"
          my="0.5"
          overflow="visible"
        >
          <NavItemContent
            item={item}
            isActive={false}
            isCollapsed={isCollapsed}
            iconSize={iconSize}
            fontSize={fontSize}
            isSecondary={isSecondary}
          />
        </Box>
      )
    }

    return (
      <NavLink to={item.href} className="w-full" onClick={() => onClose?.()}>
        <Box
          position="relative"
          my="0.5"
          overflow="visible"
        >
          <ActiveSelector isActive={isActive} isCollapsed={isCollapsed} />
          <NavItemContent
            item={item}
            isActive={isActive}
            isCollapsed={isCollapsed}
            iconSize={iconSize}
            fontSize={fontSize}
            isSecondary={isSecondary}
          />
        </Box>
      </NavLink>
    )
  }

  const SidebarContent = ({ onClose: onDrawerClose = () => { }, isMobile = false }) => (
    <Box
      ref={containerRef}
      bg={sidebarBg}
      backdropFilter="blur(12px)"
      color="white"
      py={spacing}
      px={isCollapsed && !isMobile ? 1 : paddingX}
      position="relative"
      transition="all 0.28s ease-in-out"
      w={isCollapsed && !isMobile ? collapsedWidth : sidebarWidth}
      borderRadius="28px"
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
      h="100%"
      display="flex"
      flexDirection="column"
    >
      {/* Fixed Header Section (Logo & Title) */}
      <Box flexShrink={0} pb={3}>
        {/* Logo */}
        <Flex
          justify="center"
          align="center"
          mb={2}
          overflow="hidden"
          transition="all 0.2s ease-in-out"
          py={1}
        >
          <Image
            boxSize={isCollapsed && !isMobile ? '28px' : logoSize}
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

        {/* Section Title */}
        {!(isCollapsed && !isMobile) && (
          <Text
            fontSize="2xs"
            color="whiteAlpha.700"
            textTransform="uppercase"
            letterSpacing="wider"
            textAlign="center"
            px={2}
          >
            Main Menu
          </Text>
        )}
      </Box>

      {/* Scrollable Navigation Section */}
      <Box
        flex="1"
        overflowY="auto"
        overflowX="visible"
        sx={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
            width: '0px',
            background: 'transparent',
          },
        }}
        css={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}
      >
        <VStack spacing={0} align='stretch' minH={0}>
          <Box>
            {mainNavigation.map(item => (
              <NavItem
                key={item.name}
                item={item}
                onClose={onDrawerClose}
                isCollapsed={isCollapsed && !isMobile}
                iconSize={iconSize}
                fontSize={fontSize}
              />
            ))}
          </Box>

          <Box mt="auto" pt={2}>
            <Divider my={2} borderColor="whiteAlpha.300" opacity="0.5" />
            {!(isCollapsed && !isMobile) && (
              <Text
                fontSize="2xs"
                color="whiteAlpha.700"
                textTransform="uppercase"
                letterSpacing="wider"
                mb={2}
                px={2}
              >
                System
              </Text>
            )}
            {secondaryNavigation.map(item => (
              <NavItem
                key={item.name}
                item={item}
                isSecondary
                onClose={onDrawerClose}
                isCollapsed={isCollapsed && !isMobile}
                iconSize={iconSize}
                fontSize={fontSize}
              />
            ))}
          </Box>
        </VStack>
      </Box>
    </Box>
  )

  const MobileMenuButton = () => (
    <Portal>
      <IconButton
        display={{ base: 'flex', md: 'none' }}
        onClick={onOpen}
        variant="ghost"
        position="fixed"
        top="50px"
        left="16px"
        zIndex="13"
        icon={<Bars3Icon className="h-6 w-6" color={useColorModeValue('black', 'white')} />}
        aria-label="Open menu"
        color="black"
        _hover={{
          bg: useColorModeValue('whiteAlpha.200', 'whiteAlpha.200'),
          transform: 'scale(1.05)'
        }}
        transition="all 0.2s ease-out"
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
        h="calc(100vh - 2 * var(--chakra-space-4))"
        overflow="visible"
        position="relative"
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