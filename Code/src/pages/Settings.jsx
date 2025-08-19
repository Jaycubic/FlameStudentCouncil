import {
  Box,
  Card,
  CardBody,
  Stack,
  Switch,
  Text,
  useColorMode,
  useColorModeValue,
  VStack,
  FormControl,
  FormLabel,
  Input,
  Button,
  Avatar,
  HStack,
  Divider,
  useToast,
  SimpleGrid,
  Icon,
  Badge,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  InputGroup,
  InputRightElement,
  Select,
} from '@chakra-ui/react'
import { useState, useEffect, useRef } from 'react'
import PageHeader from '../components/layout/PageHeader'
import { authService } from '../services/authService'
import { settingsService } from '../services/SettingsService'
import {
  UserIcon,
  BellIcon,
  ShieldCheckIcon,
  PaintBrushIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline'

function Settings() {
  const { colorMode, toggleColorMode } = useColorMode()
  const user = authService.getCurrentUser()
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    location: user?.location || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    language: 'en',
    notifications: {
      email: true,
      push: true,
      updates: false,
    }
  })
  const [rolesWith2FA, setRolesWith2FA] = useState([])

  const bgColor = useColorModeValue('white', 'gray.800')
  const textColor = useColorModeValue('gray.600', 'gray.300')
  const toast = useToast()
  const fileInputRef = useRef(null)
  const [photoURL, setPhotoURL] = useState(null)

  useEffect(() => {
    const fetchRolesWith2FA = async () => {
      try {
        const data = await settingsService.getAllRolesWith2FA()
        setRolesWith2FA(data)
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to fetch roles with 2FA settings.',
          status: 'error',
          duration: 3000,
        })
      }
    }
    fetchRolesWith2FA()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleNotificationChange = (key) => {
    setFormData(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key]
      }
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    toast({
      title: 'Profile Updated',
      description: 'Your profile has been successfully updated.',
      status: 'success',
      duration: 3000,
    })
  }

  const handle2FAToggle = async (roleId, newValue) => {
    try {
      await settingsService.updateSettingForRole(roleId, '2fa_enabled', newValue.toString())
      setRolesWith2FA(prev => prev.map(role => 
        role.id === roleId ? { ...role, twoFAEnabled: newValue } : role
      ))
      toast({
        title: '2FA Setting Updated',
        description: `2FA for role ${rolesWith2FA.find(r => r.id === roleId)?.name} has been ${newValue ? 'enabled' : 'disabled'}.`,
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update 2FA setting.',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoURL(reader.result)
        toast({
          title: 'Photo Updated',
          description: 'Your profile photo has been updated successfully.',
          status: 'success',
          duration: 3000,
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemovePhoto = () => {
    setPhotoURL(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    toast({
      title: 'Photo Removed',
      description: 'Your profile photo has been removed.',
      status: 'info',
      duration: 3000,
    })
  }

  const bgGradient = useColorModeValue(
    'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
    'linear(to-b, purple.700, pink.500)'
  )
  const activeTabBg = useColorModeValue(
    'linear(to-r, blue.500, blue.400)',
    'linear(to-r, purple.600, pink.400)'
  )
  const hoverTabBg = useColorModeValue(
    'linear(to-r, blue.300, blue.200)',
    'linear(to-r, purple.500, pink.300)'
  )
  const tabTextColor = useColorModeValue('white', 'gray.200')
  const inactiveTabTextColor = useColorModeValue('gray.100', 'gray.400')

  return (
    <Box p={8}>
      <PageHeader
        title="Settings"
        description="Manage your account settings and preferences"
      />

      <Card bg={bgColor} border="1px solid" borderColor="#304945">
        <CardBody>
          <Tabs variant="soft-rounded" colorScheme="vrv">
            <TabList mb={6} gap={2}>
              {[
                { name: 'Security', icon: ShieldCheckIcon },
                { name: 'Notifications', icon: BellIcon },
                { name: 'Appearance', icon: PaintBrushIcon },
              ].map((tab, index) => (
                <Tab
                  key={index}
                  gap={2}
                  bgGradient={bgGradient}
                  color={inactiveTabTextColor}
                  _selected={{ bgGradient: activeTabBg, color: tabTextColor }}
                  _hover={{ bgGradient: hoverTabBg }}
                  borderRadius="md"
                  px={4}
                  py={2}
                >
                  <Icon as={tab.icon} boxSize={4} />
                  <Text display={{ base: 'none', md: 'block' }}>{tab.name}</Text>
                </Tab>
              ))}
            </TabList>

            <TabPanels>
              {/* Security Panel */}
              <TabPanel>
                <VStack spacing={6} align="start">
                  <Text fontSize="lg" fontWeight="medium">Role-based 2FA Settings</Text>
                  <Stack spacing={4} width="full">
                    {rolesWith2FA.map(role => (
                      <HStack key={role.id} justify="space-between">
                        <Box>
                          <Text fontWeight="medium">{role.name}</Text>
                          <Text fontSize="sm" color={textColor}>
                            {role.description}
                          </Text>
                        </Box>
                        <Switch
                          isChecked={role.twoFAEnabled}
                          onChange={() => handle2FAToggle(role.id, !role.twoFAEnabled)}
                          colorScheme="vrv"
                        />
                      </HStack>
                    ))}
                  </Stack>
                </VStack>
              </TabPanel>

              {/* Notifications Panel */}
              <TabPanel>
                <VStack spacing={6} align="start">
                  <Text fontSize="lg" fontWeight="medium">Notification Preferences</Text>
                  
                  <Stack spacing={4} width="full">
                    <HStack justify="space-between">
                      <Box>
                        <Text fontWeight="medium">Email Notifications</Text>
                        <Text fontSize="sm" color={textColor}>
                          Receive notifications via email
                        </Text>
                      </Box>
                      <Switch
                        isChecked={formData.notifications.email}
                        onChange={() => handleNotificationChange('email')}
                        colorScheme="vrv"
                      />
                    </HStack>

                    <Divider />

                    <HStack justify="space-between">
                      <Box>
                        <Text fontWeight="medium">Push Notifications</Text>
                        <Text fontSize="sm" color={textColor}>
                          Receive push notifications
                        </Text>
                      </Box>
                      <Switch
                        isChecked={formData.notifications.push}
                        onChange={() => handleNotificationChange('push')}
                        colorScheme="vrv"
                      />
                    </HStack>

                    <Divider />

                    <HStack justify="space-between">
                      <Box>
                        <Text fontWeight="medium">Product Updates</Text>
                        <Text fontSize="sm" color={textColor}>
                          Receive updates about product changes
                        </Text>
                      </Box>
                      <Switch
                        isChecked={formData.notifications.updates}
                        onChange={() => handleNotificationChange('updates')}
                        colorScheme="vrv"
                      />
                    </HStack>
                  </Stack>
                </VStack>
              </TabPanel>

              {/* Appearance Panel */}
              <TabPanel>
                <VStack spacing={6} align="start">
                  <Text fontSize="lg" fontWeight="medium">Appearance Settings</Text>
                  
                  <Stack spacing={4} width="full">
                    <HStack justify="space-between">
                      <Box>
                        <Text fontWeight="medium">Dark Mode</Text>
                        <Text fontSize="sm" color={textColor}>
                          Toggle between light and dark themes
                        </Text>
                      </Box>
                      <Switch
                        isChecked={colorMode === 'dark'}
                        onChange={toggleColorMode}
                        colorScheme="vrv"
                      />
                    </HStack>
                  </Stack>
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </CardBody>
      </Card>
    </Box>
  )
}

export default Settings
