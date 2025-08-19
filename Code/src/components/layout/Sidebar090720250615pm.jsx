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
  ChevronLeftIcon,
  ChevronRightIcon,
  AcademicCapIcon,
  MapPinIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import { authService } from '../../services/authService'
import { useState } from 'react'
import Logo from '../../assets/img/FLAME.png' // Import the logo

function Sidebar() {
  const navigate = useNavigate()
  const user = authService.getCurrentUser()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Gradient palettes
  const bgGradient = useColorModeValue(
    'linear(to-b, teal.400, blue.500)',
    'linear(to-b, purple.700, pink.500)'
  )
  const borderColor = useColorModeValue('teal.600', 'pink.600')
  const activeItemBg = useColorModeValue(
    'linear(to-r, teal.500, green.500)',
    'linear(to-r, purple.600, pink.400)'
  )
  const hoverBg = useColorModeValue(
    'linear(to-r, teal.300, green.300)',
    'linear(to-r, purple.500, pink.300)'
  )
  const secondaryTextColor = useColorModeValue('gray.100', 'gray.400')

  const allNavigation = [
    { name: 'Dashboard', href: '/', icon: HomeIcon, roles: ['admin', 'Manager', 'Employee'] },
    { name: 'StudentInfo', href: '/roles', icon: AcademicCapIcon, roles: ['admin'] },
    { name: 'StudentHouseTracking', href: '/departments', icon: BuildingOfficeIcon, roles: ['admin', 'Manager'] },
    { name: 'Parent Info', href: '/parentsinfo', icon: UsersIcon, roles: ['admin', 'Manager'] },
    { name: 'Tracking Info', href: '/trackinginfo', icon: MapPinIcon, roles: ['admin', 'Manager'] },
    { name: 'Analytics', href: '/analytics', icon: ChartBarIcon, roles: ['admin', 'Manager'] },
    { name: 'Calendar', href: '/calendar', icon: CalendarIcon, roles: ['admin', 'Manager', 'Employee'] },
    { name: 'Users', href: '/users', icon: UserGroupIcon, roles: ['admin', 'Manager'] },
    { name: 'Profile', href: '/profile', icon: UserIcon, roles: ['admin', 'Manager', 'Employee'] },
  ]
  const mainNavigation = allNavigation.filter(item => item.roles.includes(user?.role))
  
  const secondaryNavigation = [
    { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, roles: ['admin', 'Manager', 'Employee'] },
    { name: 'Logout', href: '#', icon: ArrowLeftOnRectangleIcon, onClick: () => { authService.logout(); navigate('/login') }, roles: ['admin', 'Manager', 'Employee'] },
  ].filter(item => item.roles.includes(user?.role))

  const SidebarContent = ({ onClose: onDrawerClose = () => {} }) => (
    <Box
      bgGradient={bgGradient}
      color="white"
      h="full"
      py="5"
      position="relative"
      transition="all 0.3s ease-in-out"
      w={isCollapsed ? '20' : '80'}
    >
      {/* Collapse Toggle */}
      <IconButton
        icon={isCollapsed ? <ChevronRightIcon className="h-5 w-5" /> : <ChevronLeftIcon className="h-5 w-5" />}
        position="absolute"
        right="-5"
        top="50%"
        transform="translateY(-50%)"
        size="md"
        rounded="full"
        border="1px solid"
        borderColor={borderColor}
        display={{ base: 'none', md: 'flex' }}
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-label={isCollapsed ? "Expand" : "Collapse"}
        zIndex="10"
        transition="all 0.2s ease-in-out"
        _hover={{ transform: "translateY(-50%) scale(1.1)", boxShadow: "lg" }}
      />

      <Flex direction="column" h="full">
        {/* Logo and Text */}
        <Flex align="center" px="6" mb="8" overflow="hidden" transition="all 0.3s ease-in-out">
          <Image
            h={isCollapsed ? "8" : "12"}
            w="auto"
            src={Logo}
            alt="FLAME Logo"
            fallbackSrc="https://via.placeholder.com/36"
            transition="transform 0.3s ease-in-out"
            _hover={{ transform: "scale(1.05)" }}
          />
          {!isCollapsed && (
            <Box ml="4">
              <Text fontSize="lg" fontWeight="bold" letterSpacing="tight">FLAME University</Text>
            </Box>
          )}
        </Flex>

        {/* Navigation */}
        <VStack spacing="2" align='stretch' flex="1">
          {!isCollapsed && <Text px="6" fontSize="xs" color={secondaryTextColor} textTransform="uppercase" letterSpacing="wider" mb="2">Main Menu</Text>}
          {mainNavigation.map(item => (
            <NavItem key={item.name} item={item} onClose={onDrawerClose} activeItemBg={activeItemBg} hoverBg={hoverBg} isCollapsed={isCollapsed} />
          ))}

          <Box mt="auto">
            <Divider my="4" borderColor={borderColor} opacity="0.3" display={{ base: 'none', md: 'block' }} />
            {!isCollapsed && <Text px="6" fontSize="xs" color={secondaryTextColor} textTransform="uppercase" letterSpacing="wider" mb="2">System</Text>}
            {secondaryNavigation.map(item => (
              <NavItem key={item.name} item={item} isSecondary onClose={onDrawerClose} activeItemBg={activeItemBg} hoverBg={hoverBg} isCollapsed={isCollapsed} />
            ))}
          </Box>
        </VStack>

        {/* User Info */}
        <Box px="4" mt="6">
          <Tooltip label={isCollapsed ? `${user?.username || 'Unknown User'}` : ''} placement="right">
            <Flex
              p="3"
              rounded="xl"
              bgGradient={activeItemBg}
              align="center"
              cursor="pointer"
              _hover={{ bgGradient: hoverBg }}
              transition="all 0.3s"
            >
              <Box
                w="8"
                h="8"
                rounded="lg"
                bgGradient={hoverBg}
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontSize="sm"
                fontWeight="bold"
                transition="all 0.3s ease-in-out"
                _hover={{ transform: "scale(1.05)" }}
              >
                {user?.name?.charAt(0) || '?'}
              </Box>
              {!isCollapsed && (
                <Box ml="3" flex="1">
                  <Text fontSize="sm" fontWeight="medium">{user?.username || 'Unknown'}</Text>
                  <Text fontSize="xs" opacity="0.7">{user?.email || 'no@email.com'}</Text>
                </Box>
              )}
            </Flex>
          </Tooltip>
        </Box>
      </Flex>
    </Box>
  )

  const NavItem = ({ item, isSecondary = false, onClose, activeItemBg, hoverBg, isCollapsed }) => {
    const isMobile = window.innerWidth < 768;
    const Content = (
      <Tooltip label={isCollapsed ? item.name : ''} placement="right">
        <Flex
          align="center"
          px="4"
          py="3"
          m={isCollapsed ? '3' : '0'}
          rounded="xl"
          transition="all 0.3s ease-in-out"
          _hover={{ bgGradient: hoverBg }}
          opacity={isSecondary ? 0.8 : 1}
        >
          <Icon as={item.icon} boxSize="5" color="white" />
          {!isCollapsed && <Text ml="3" fontSize="sm" fontWeight="medium" color="white">{item.name}</Text>}
        </Flex>
      </Tooltip>
    );

    if (item.onClick) {
      return (
        <Box as="button" w="full" onClick={() => { item.onClick(); onClose?.(); }} className="transition">
          {Content}
        </Box>
      )
    }

    if (isMobile) {
      return (
        <Box as="a" href={item.href} w="full" onClick={() => onClose?.()} className="transition">
          {Content}
        </Box>
      )
    }

    return (
      <NavLink to={item.href} className="w-full transition" onClick={() => onClose?.()}>
        {({ isActive }) => (
          <Box
            bg={isActive ? activeItemBg : 'transparent'}
            position="relative"
            _before={isActive ? {
              content: '""',
              position: 'absolute',
              left: '0',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '4px',
              height: '70%',
              bg: 'white',
              borderRadius: 'full',
            } : {}}
          >
            {Content}
          </Box>
        )}
      </NavLink>
    )
  }

  const MobileMenuButton = () => (
    <IconButton
      display={{ base: 'flex', md: 'none' }}
      onClick={onOpen}
      variant="ghost"
      position="fixed"
      top="4"
      left="4"
      zIndex={10}
      icon={<Bars3Icon className="h-6 w-6" />}
      aria-label="Open menu"
      color="white"
      _hover={{ bgGradient: hoverBg }}
    />
  )

  return (
    <>
      <MobileMenuButton />
      <Box as="aside" transition="all 0.3s" w={isCollapsed ? '20' : '80'} display={{ base: 'none', md: 'block' }}>
        <SidebarContent />
      </Box>
      <Box display={{ base: 'block', md: 'none' }}>
        <Drawer isOpen={isOpen} placement="top" onClose={onClose}>
          <DrawerOverlay />
          <DrawerContent bgGradient={bgGradient} w="100vw">
            <DrawerCloseButton color="white" />
            <SidebarContent onClose={onClose} />
          </DrawerContent>
        </Drawer>
      </Box>
    </>
  )
}

export default Sidebar
