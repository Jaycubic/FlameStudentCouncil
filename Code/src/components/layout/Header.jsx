import { useState, useEffect } from 'react'
import {
  Box,
  Flex,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Text,
  HStack,
  useColorMode,
  useColorModeValue,
  Tooltip,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  Stack,
  Circle,
  Icon,
  Portal,
} from '@chakra-ui/react'
import { BellIcon, MoonIcon, SunIcon, UserIcon, ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import { authService } from '../../services/authService'
import notificationService from '../../services/notificationService'

function Header() {
  const navigate = useNavigate()
  const user = authService.getCurrentUser()
  const { colorMode, toggleColorMode } = useColorMode()
  
  const rightContainerBg = useColorModeValue(
    'linear-gradient(135deg, rgba(30, 58, 138, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
    'linear(to-b, rgba(126, 34, 206, 0.2) 0%, rgba(219, 39, 119, 0.2) 100%)'
  )
  const rightContainerBorder = useColorModeValue('blue.800', 'pink.600')
  const iconColor = useColorModeValue('white', 'white')
  const hoverBg = useColorModeValue(
    'linear(to-r, blue.300, blue.200)',
    'linear(to-r, purple.500, pink.300)'
  )
  
  const notificationBg = useColorModeValue('whiteAlpha.900', 'gray.800')
  const unreadBg = useColorModeValue('blue.50', 'gray.700')
  const hoverBgColor = useColorModeValue('blue.100', 'gray.700')

  const menuBg = useColorModeValue('white', 'gray.800')
  const menuBorderColor = useColorModeValue('gray.200', 'gray.700')
  const menuItemBg = useColorModeValue('white', 'gray.800')
  const menuItemHoverBg = useColorModeValue('gray.50', 'gray.700')
  const menuTextColor = useColorModeValue('gray.700', 'gray.200')
  const iconBg = useColorModeValue('blue.50', 'whiteAlpha.100')
  const markAllColor = useColorModeValue('blue.500', 'purple.500')

  const handleLogout = () => {
    authService.logout()
    navigate('/login')
  }

  const [notifications, setNotifications] = useState([])

  const fetchNotifications = async () => {
    try {
      const data = await notificationService.getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length

  const handleNotificationClick = async (id) => {
    try {
      await notificationService.markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const activityIds = notifications.map(n => n.id);
      await notificationService.markAllAsRead(activityIds);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const clearNotifications = async () => {
    try {
      const activityIds = notifications.map(n => n.id);
      await notificationService.clearAll(activityIds);
      setNotifications([]);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const endlessRiverGradient = useColorModeValue(
    'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
    'linear(to-b, purple.700, pink.500)'
  );

  const endlessRiverHoverGradient = useColorModeValue(
    'linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%)',
    'linear(to-b, pink.500, purple.700)'
  );

  const titleGradient = useColorModeValue(
    'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
    'white'
  );

  const subtitleColor = useColorModeValue(
    'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
    'whiteAlpha.700'
  );

  return (
    <Box bg="transparent" px={{ base: 3, md: 4, lg: 6 }} py={{ base: 2, md: 3 }}>
      <Flex 
        h={{ base: 14, md: 16 }} 
        alignItems="center" 
        justifyContent="space-between" 
        maxW="container.xl" 
        mx="auto"
      >
        <Box>
          <Text
            fontSize={{ base: "lg", md: "xl", lg: "2xl" }}
            fontWeight="bold"
            color={useColorModeValue("gray.800", "white")} // Adjusted to white in dark mode
            lineHeight="1.2"
          >
            FLAME STS
          </Text>
          <Text
            fontSize={{ base: "xs", md: "sm" }}
            fontWeight="medium"
            color={useColorModeValue("gray.600", "whiteAlpha.800")} // Adjusted to whiteAlpha.800 in dark mode
            mt={0.5}
          >
            Biometric-Based Student Monitoring
          </Text>
        </Box>
        <Box
          bgGradient={endlessRiverGradient}
          _hover={{ bgGradient: endlessRiverHoverGradient }}
          backdropFilter="blur(20px)"
          border="1px solid"
          borderColor={rightContainerBorder}
          borderRadius={{ base: "full", md: "2xl" }}
          px={{ base: 2, md: 3, lg: 4 }}
          py={{ base: 1, md: 2 }}
          boxShadow="md"
        >
          <HStack spacing={{ base: 1, md: 3, lg: 4 }}>
            <Tooltip label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode` }>
              <IconButton
                size={{ base: 'sm', md: 'md' }}
                variant="ghost"
                bg="transparent"
                icon={colorMode === 'light' ? <MoonIcon className="h-4 w-4 md:h-5 md:w-5" /> : <SunIcon className="h-4 w-4 md:h-5 md:w-5" />}
                onClick={toggleColorMode}
                aria-label="Toggle color mode"
                color={iconColor}
                _hover={{ bg: hoverBg }}
              />
            </Tooltip>

            <Box position="relative">
              <Popover>
                <PopoverTrigger>
                  <Box position="relative">
                    <IconButton
                      size={{ base: 'sm', md: 'md' }}
                      variant="ghost"
                      bg="transparent"
                      icon={<BellIcon className="h-5 w-5 md:h-6 md:w-6" />}
                      aria-label="Notifications"
                      color={iconColor}
                      _hover={{ bg: hoverBg }}
                      onClick={fetchNotifications}
                    />
                    {unreadCount > 0 && (
                      <Circle size={{ base: "4", md: "5" }} bg="red.500" color="white" position="absolute" top={-1} right={-1} fontSize="xs" fontWeight="bold">
                        {unreadCount}
                      </Circle>
                    )}
                  </Box>
                </PopoverTrigger>

                {/* Portal + high zIndex ensures the popover is rendered above everything */}
                <Portal>
                  <PopoverContent
                    w={{ base: "300px", md: "350px" }}
                    bg={notificationBg}
                    border="1px solid"
                    borderColor={rightContainerBorder}
                    _focus={{ boxShadow: 'none' }}
                    zIndex="9999"
                  >
                    <PopoverArrow />
                    <PopoverHeader borderBottomWidth="1px" py={4}>
                      <Flex justify="space-between" align="center">
                        <Text fontWeight="medium">Notifications</Text>
                        <HStack spacing={2}>
                          <Text fontSize="sm" color={markAllColor} cursor="pointer" onClick={markAllAsRead} _hover={{ textDecoration: 'underline' }}>Mark all as read</Text>
                          <Text fontSize="sm" color="red.500" cursor="pointer" onClick={clearNotifications} _hover={{ textDecoration: 'underline' }}>Clear all</Text>
                        </HStack>
                      </Flex>
                    </PopoverHeader>
                    <PopoverBody p={0}>
                      <Stack spacing={0} maxH="400px" overflowY="auto">
                        {notifications.length === 0 ? (
                          <Box p={4} textAlign="center">
                            <Text color="gray.500">No notifications</Text>
                          </Box>
                        ) : (
                          notifications.map(notification => (
                            <Box
                              key={notification.id}
                              p={4}
                              bg={notification.isRead ? 'transparent' : unreadBg}
                              _hover={{ bg: hoverBgColor }}
                              cursor="pointer"
                              onClick={() => handleNotificationClick(notification.id)}
                              borderBottomWidth="1px"
                              borderColor="inherit"
                            >
                              <Text fontWeight="medium" fontSize="sm">{notification.title}</Text>
                              <Text fontSize="sm" color="gray.500" mt={1}>{notification.description}</Text>
                              <Text fontSize="xs" color="gray.400" mt={1}>{new Date(notification.time).toLocaleString()}</Text>
                            </Box>
                          ))
                        )}
                      </Stack>
                    </PopoverBody>
                  </PopoverContent>
                </Portal>
              </Popover>
            </Box>

            <Menu>
              <MenuButton 
                as={Flex} 
                align="center" 
                cursor="pointer" 
                bg="transparent"
                p={{ base: 1, md: 2 }} 
                rounded="lg" 
                _hover={{ bg: hoverBg }} 
                transition="all 0.2s"
              >
                <Flex align="center" minW={{ base: "auto", md: "180px", lg: "200px" }}>
                  <Box w={{ base: "6", md: "7", lg: "8" }} h={{ base: "6", md: "7", lg: "8" }} rounded="lg" bg={hoverBg} display="flex" alignItems="center" justifyContent="center">
                    <Icon as={UserIcon} w={{ base: "4", md: "5", lg: "6" }} h={{ base: "4", md: "5", lg: "6" }} color={iconColor} />
                  </Box>
                  <Box ml={{ base: 1, md: 2, lg: 3 }} flex="1" display={{ base: 'none', md: 'block' }}>
                    <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="medium" color="white" noOfLines={1}>{user?.username}</Text>
                    <Text fontSize={{ base: "2xs", md: "xs" }} color="whiteAlpha.800" noOfLines={1}>{user?.email}</Text>
                  </Box>
                </Flex>
              </MenuButton>

              {/* Render menu in a portal too to avoid being clipped by layout containers */}
              <Portal>
                <MenuList bg={menuBg} borderColor={menuBorderColor} shadow="lg" py={2} overflow="hidden" zIndex="9999">
                  <MenuItem bg={menuItemBg} _hover={{ bg: useColorModeValue('red.50','red.900'), color:'red.500' }} color={menuTextColor} px={{ base:3,md:4}} py={{ base:2,md:3}} fontSize="sm" fontWeight="medium" onClick={handleLogout}>
                    <HStack spacing={{ base:2,md:3}}>
                      <Box p={{ base:1.5,md:2}} bg={useColorModeValue('red.50','whiteAlpha.100')} rounded="md" color={useColorModeValue('red.500','red.300')}><ArrowLeftOnRectangleIcon className="h-4 w-4" /></Box>
                      <Text>Sign out</Text>
                    </HStack>
                  </MenuItem>
                </MenuList>
              </Portal>
            </Menu>
          </HStack>
        </Box>
      </Flex>
    </Box>
  )
}

export default Header
