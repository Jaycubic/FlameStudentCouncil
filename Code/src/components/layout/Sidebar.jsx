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
  Skeleton,
  Collapse,
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
  DocumentIcon,
  FolderOpenIcon,
  ClipboardDocumentListIcon,
  BookOpenIcon,
  TrophyIcon,
  ChevronDownIcon,
  KeyIcon,
  XMarkIcon,
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
      <Box
        bgGradient={useColorModeValue(
          'linear-gradient(135deg, #1E3C72 0%, #2563eb 100%, #2A5298 50%)',
          'linear(to-b, purple.700, pink.500)'
        )}
        backdropFilter="blur(12px)"
        color="white"
        py={useBreakpointValue({ base: 1, md: 2, lg: 3 })}
        px={useBreakpointValue({ base: 2, md: 3, lg: 4 })}
        position="relative"
        transition="all 0.28s ease-in-out"
        w={useBreakpointValue({ base: '64px', md: '220px', lg: '240px' })}
        borderRadius={useBreakpointValue({ base: '20px', md: '24px' })}
        boxShadow="xl"
        border="1px solid"
        borderColor={useColorModeValue('blue.800', 'pink.600')}
        h="100%"
        overflowY="auto"
        overflowX="hidden"
        sx={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
        css={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}
      >
        <Flex direction="column" minH="full">
          <Flex
            justify="center"
            align="center"
            mb={2}
            overflow="hidden"
            transition="all 0.2s ease-in-out"
          >
            <Skeleton height={useBreakpointValue({ base: '36px', md: '64px', lg: '72px' })} width={useBreakpointValue({ base: '36px', md: '64px', lg: '72px' })} borderRadius="lg" />
          </Flex>
          <VStack spacing={1} align='stretch' flex="1" minH={0}>
            <Box>
              {[...Array(6)].map((_, i) => (
                <Flex
                  key={i}
                  align="center"
                  justify="center"
                  px={2}
                  py={2}
                  rounded="full"
                  transition="all 0.18s ease-in-out"
                  mb={1}
                >
                  <Skeleton height="20px" width="20px" borderRadius="full" mr={3} />
                  {!useBreakpointValue({ base: true, md: false }) && <Skeleton height="16px" width="100px" />}
                </Flex>
              ))}
            </Box>
            <Box mt="auto">
              <Skeleton height="1px" width="full" mb={2} />
              {[...Array(2)].map((_, i) => (
                <Flex
                  key={i}
                  align="center"
                  justify="center"
                  px={2}
                  py={2}
                  rounded="full"
                  transition="all 0.18s ease-in-out"
                  mb={1}
                >
                  <Skeleton height="20px" width="20px" borderRadius="full" mr={3} />
                  {!useBreakpointValue({ base: true, md: false }) && <Skeleton height="16px" width="80px" />}
                </Flex>
              ))}
            </Box>
          </VStack>
        </Flex>
      </Box>
    );
  }

  const { isOpen, onOpen, onClose } = useDisclosure()
  const isDesktop = useBreakpointValue({ base: false, md: true })
  const [isCollapsed, setIsCollapsed] = useState(isDesktop)
  const [expandedGroups, setExpandedGroups] = useState({})
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
    'linear-gradient(135deg, #1E3C72 0%, #2563eb 100%, #2A5298 50%)',
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
    { name: 'Dashboard', href: '/', icon: HomeIcon, roles: ['admin', 'Faculty', 'user', 'SportsFaculty', 'SportsVisitingFaculty'] },

    // Group: Academic Planning
    {
      type: 'group',
      name: 'Academic Planning',
      icon: AcademicCapIcon,
      children: [
        { name: 'Major & Minor', href: '/majorminor', icon: AcademicCapIcon, roles: ['admin', 'Faculty'] },
        { name: 'Annexure', href: '/annexure', icon: DocumentIcon, roles: ['admin', 'Faculty', 'user'] },
        { name: 'Course Allocation', href: '/annexureStudent', icon: CalendarIcon, roles: ['admin', 'Faculty'] },
        { name: 'Foundation Core', href: '/foundation-core-planning', icon: BookOpenIcon, roles: ['admin', 'Faculty', 'user'] },
        { name: 'Negative Prerequisites', href: '/negative-courses', icon: XMarkIcon, roles: ['admin', 'Faculty', 'user'] },
      ]
    },

    // Group: Academic Audit
    {
      type: 'group',
      name: 'Academic Audit',
      icon: ClipboardDocumentListIcon,
      children: [
        { name: 'UG & BDES Audit', href: '/auditing-console', icon: ClipboardDocumentListIcon, roles: ['admin', 'Faculty', 'user'] },
        { name: 'Audit Data Upload', href: '/degree-progress-audit', icon: BookOpenIcon, roles: ['admin', 'Faculty', 'user'] },
      ]
    },

    // Group: Academic Master Data
    {
      type: 'group',
      name: 'Academic Master',
      icon: BuildingOfficeIcon,
      children: [
        { name: 'Student Master', href: '/student-master', icon: UsersIcon, roles: ['admin', 'Student', 'user', 'Council', 'AdminLite'] },
        { name: 'Academic Cluster', href: '/academic-cluster', icon: BuildingOfficeIcon, roles: ['admin', 'AdminLite'] },
        { name: 'CourseAreaMaster', href: '/coursearea-master', icon: BookOpenIcon, roles: ['admin', 'Faculty', 'user'] },
      ]
    },

    // Group: Faculty Management
    {
      type: 'group',
      name: 'Faculty Admin',
      icon: IdentificationIcon,
      children: [
        { name: 'Faculty Info', href: '/faculty', icon: IdentificationIcon, roles: ['admin', 'AdminLite'] },
        { name: 'Faculty Activation', href: '/faculty-activation', icon: KeyIcon, roles: ['admin', 'AdminLite'] },
      ]
    },

    {
      type: 'group',
      name: 'Course Feedback',
      icon: ClipboardDocumentIcon,
      children: [
        { name: 'End-Term Faculty Feedback', href: '/faculty-feedback', icon: ClipboardDocumentIcon, roles: ['admin', 'AdminLite', 'user'] },
        { name: 'Mid-Term Faculty Feedback', href: '/midterm-faculty-feedback', icon: ClipboardDocumentIcon, roles: ['admin', 'AdminLite', 'user'] },
      ],
    },
    {
      type: 'group',
      name: 'Sports Admin',
      icon: TrophyIcon,
      children: [
        { name: 'Attendance', href: '/sports-dashboard', icon: HomeIcon, roles: ['admin', 'Student', 'user', 'Council', 'AdminLite', 'SportsFaculty', 'SportsVisitingFaculty'] },
        { name: 'Registered-Students', href: '/sports-registered', icon: TrophyIcon, roles: ['admin', 'Student', 'user', 'Council', 'AdminLite', 'SportsFaculty', 'SportsVisitingFaculty'] },
        { name: 'Sports-Schedule', href: '/sports-schedule', icon: CalendarIcon, roles: ['admin', 'Student', 'user', 'Council', 'AdminLite', 'SportsFaculty', 'SportsVisitingFaculty'] },
      ],
    },

    // Group: Miscellaneous
    {
      type: 'group',
      name: 'Miscellaneous',
      icon: QueueListIcon,
      children: [
        { name: 'Task Manager', href: '/task-manager', icon: ClipboardDocumentListIcon, roles: ['admin', 'Faculty', 'user', 'AdminLite'] },
        { name: 'ID cards', href: '/id-cards', icon: IdentificationIcon, roles: ['admin', 'AdminLite'] },
      ]
    },
    // Standalone from User Management dissolution
    { name: 'Users Admin', href: '/users', icon: UserGroupIcon, roles: ['admin'] },

    { name: 'Documentation & License', href: '/profile', icon: FolderOpenIcon, roles: ['admin', 'Faculty', 'user', 'AdminLite', 'Council'] },
  ]

  let processedMainNav = []
  if (user?.role) {
    allNavigation.forEach((item) => {
      if (item.type === 'group') {
        const visibleChildren = item.children.filter((child) => child.roles.includes(user.role))
        if (visibleChildren.length > 0) {
          const groupCopy = { ...item, children: visibleChildren }
          processedMainNav.push(groupCopy)
        }
      } else if (item.roles.includes(user.role)) {
        processedMainNav.push(item)
      }
    })
  } else {
    processedMainNav = [{ name: 'Home', href: '/', icon: HomeIcon, roles: [] }]
  }

  const secondaryNavigation = user?.role
    ? [
      { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, roles: ['admin'] },
      { name: 'Logout', href: '#', icon: ArrowLeftOnRectangleIcon, onClick: () => { authService.logout(); navigate('/login') }, roles: ['admin', 'Student', 'user', 'SportsFaculty'] },
    ].filter(item => item.roles.includes(user.role))
    : []

  const GroupHeader = ({ item, isExpanded, onToggle, isCollapsed, iconSize, fontSize, textColor, iconColor, hoverBg, secondaryTextColor }) => (
    <Tooltip label={isCollapsed ? item.name : ''} placement="right">
      <Flex
        as="button"
        w="full"
        align="center"
        justify={isCollapsed ? 'center' : 'flex-start'}
        px={isCollapsed ? 2 : 3}
        py={2}
        rounded={isCollapsed ? 'full' : 'md'}
        transition="all 0.18s ease-in-out"
        _hover={{ bgGradient: hoverBg, transform: isCollapsed ? 'none' : 'translateX(6px)' }}
        onClick={() => { if (!isCollapsed || isCollapsed === false) onToggle() }}
        whiteSpace="nowrap"
        overflow="hidden"
      >
        <Icon as={item.icon} boxSize={iconSize} color={iconColor} transition="all 0.18s ease-in-out" />
        {!isCollapsed && (
          <>
            <Text ml={3} fontSize={fontSize} fontWeight="semibold" color={textColor} transition="all 0.18s ease-in-out" textOverflow="ellipsis" overflow="hidden">
              {item.name}
            </Text>
            <Icon
              as={ChevronDownIcon}
              boxSize={iconSize === '24px' ? '20px' : '16px'}
              ml="auto"
              mr={2}
              color={secondaryTextColor}
              transition="transform 0.2s ease-in-out"
              transform={isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}
            />
          </>
        )}
      </Flex>
    </Tooltip>
  )

  const SidebarContent = ({ onClose: onDrawerClose = () => { }, isMobile = false }) => {
    const currentIsCollapsed = isCollapsed && !isMobile
    return (
      <Box
        ref={containerRef}
        bgGradient={bgGradient}
        backdropFilter="blur(12px)"
        color="white"
        py={spacing}
        px={currentIsCollapsed ? 2 : paddingX}
        position="relative"
        transition="all 0.28s ease-in-out"
        w={currentIsCollapsed ? collapsedWidth : sidebarWidth}
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
            setExpandedGroups({})
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
              boxSize={currentIsCollapsed ? '32px' : logoSize} // Slightly smaller logo
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
            {!(currentIsCollapsed) && <Text fontSize="2xs" color={secondaryTextColor} textTransform="uppercase" letterSpacing="wider" mb={1} textAlign="center">Main Menu</Text>}

            <Box>
              {processedMainNav.flatMap((item) => {
                if (item.type === 'group') {
                  const isExpanded = expandedGroups[item.name] || false
                  const groupHeader = (
                    <GroupHeader
                      key={`${item.name}-header`}
                      item={item}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedGroups((prev) => ({ ...prev, [item.name]: !prev[item.name] }))}
                      isCollapsed={currentIsCollapsed}
                      iconSize={iconSize}
                      fontSize={fontSize}
                      textColor={textColor}
                      iconColor={iconColor}
                      hoverBg={hoverBg}
                      secondaryTextColor={secondaryTextColor}
                    />
                  )
                  const groupChildren = isExpanded ? (
                    <Collapse key={`${item.name}-collapse`} in={isExpanded} animateOpacity>
                      <VStack spacing={0} align="stretch" pl={currentIsCollapsed ? 0 : 4}>
                        {item.children.map((child) => (
                          <NavItem
                            key={child.name}
                            item={child}
                            onClose={onDrawerClose}
                            activeItemBg={activeItemBg}
                            hoverBg={hoverBg}
                            isCollapsed={currentIsCollapsed}
                            iconSize={iconSize}
                            fontSize={fontSize}
                            textColor={textColor}
                            iconColor={iconColor}
                            activeTextColor={activeTextColor}
                            activeIconColor={activeIconColor}
                            activeIndicatorColor={activeIndicatorColor}
                            isSub={true}
                          />
                        ))}
                      </VStack>
                    </Collapse>
                  ) : null
                  return [groupHeader, groupChildren].filter(Boolean)
                } else {
                  return (
                    <NavItem
                      key={item.name}
                      item={item}
                      onClose={onDrawerClose}
                      activeItemBg={activeItemBg}
                      hoverBg={hoverBg}
                      isCollapsed={currentIsCollapsed}
                      iconSize={iconSize}
                      fontSize={fontSize}
                      textColor={textColor}
                      iconColor={iconColor}
                      activeTextColor={activeTextColor}
                      activeIconColor={activeIconColor}
                      activeIndicatorColor={activeIndicatorColor}
                    />
                  )
                }
              })}
            </Box>

            <Box mt="auto">
              <Divider my={spacing} borderColor={borderColor} opacity="0.5" />
              {!(currentIsCollapsed) && <Text fontSize="xs" color={secondaryTextColor} textTransform="uppercase" letterSpacing="wider" mb={spacing}>System</Text>}
              {secondaryNavigation.map(item => (
                <NavItem
                  key={item.name}
                  item={item}
                  isSecondary
                  onClose={onDrawerClose}
                  activeItemBg={activeItemBg}
                  hoverBg={hoverBg}
                  isCollapsed={currentIsCollapsed}
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
  }

  const NavItem = ({ item, isSecondary = false, onClose, activeItemBg, hoverBg, isCollapsed, iconSize, fontSize, textColor, iconColor, activeTextColor, activeIconColor, activeIndicatorColor, isSub = false }) => {
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
            isSub={isSub}
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
              isSub={isSub}
            />
          </Box>
        )}
      </NavLink>
    )
  }

  const NavItemContent = ({ item, isActive, isCollapsed, hoverBg, isSecondary, iconSize, fontSize, textColor, iconColor, activeTextColor, activeIconColor, isSub = false }) => {
    const effectiveFontSize = isSub ? useBreakpointValue({ base: '10px', md: '12px' }) : fontSize
    const effectivePx = isCollapsed ? 2 : isSub ? 5 : 3
    return (
      <Tooltip label={isCollapsed ? item.name : ''} placement="right">
        <Flex
          align="center"
          justify={isCollapsed ? 'center' : 'flex-start'}
          px={effectivePx}
          py={2}
          rounded={isCollapsed ? 'full' : 'md'}
          transition="all 0.18s ease-in-out"
          _hover={{ bgGradient: hoverBg, transform: isCollapsed ? 'none' : 'translateX(6px)' }}
          opacity={isSecondary ? 0.9 : 1}
          whiteSpace="nowrap"
          overflow="hidden"
        >
          <Icon as={item.icon} boxSize={iconSize} color={isActive ? activeIconColor : iconColor} transition="all 0.18s ease-in-out" />
          {!isCollapsed && <Text ml={3} fontSize={effectiveFontSize} fontWeight={isActive ? "bold" : "medium"} color={isActive ? activeTextColor : textColor} transition="all 0.18s ease-in-out" textOverflow="ellipsis" overflow="hidden">{item.name}</Text>}
        </Flex>
      </Tooltip>
    )
  }
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