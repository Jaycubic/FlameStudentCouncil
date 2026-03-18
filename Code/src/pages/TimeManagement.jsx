// src/pages/TimeManagement.jsx
import {
    Box,
    Card,
    CardBody,
    Stack,
    Text,
    useColorModeValue,
    VStack,
    FormControl,
    FormLabel,
    Input,
    Button,
    HStack,
    useToast,
    Icon,
    Container,
    Divider,
    SimpleGrid
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import PageHeader from '../components/layout/PageHeader'
import { timeSettingsService } from '../services/timeSettingsService'
import { ClockIcon, CalendarIcon, PencilIcon, DocumentTextIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'

function TimeManagement() {
    const toast = useToast()
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)
    const [updatingTemplate, setUpdatingTemplate] = useState({ cultural: false, sports: false })
    const [formData, setFormData] = useState({
        title: '',
        start_date: '',
        end_date: '',
        start_time: '',
        end_time: '',
        days: 7
    })

    const bgColor = useColorModeValue('white', 'gray.800')
    const textColor = useColorModeValue('gray.600', 'gray.300')
    const borderColor = useColorModeValue('gray.200', '#304945')

    const bgGradient = useColorModeValue(
        'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
        'linear(to-b, purple.700, pink.500)'
    )

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const response = await timeSettingsService.getSettings()
            if (response.success && response.data) {
                const d = response.data
                setFormData({
                    title: d.title || '',
                    start_date: d.start_date || '',
                    end_date: d.end_date || '',
                    start_time: d.start_time || '',
                    end_time: d.end_time || '',
                    days: d.days || 7
                })
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch existing time settings.',
                status: 'error',
                duration: 3000,
            })
        } finally {
            setFetching(false)
        }
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        try {
            await timeSettingsService.updateSettings(formData)
            toast({
                title: 'Updated!',
                description: 'Time settings and Award title updated successfully.',
                status: 'success',
                duration: 3000,
            })
        } catch (error) {
            toast({
                title: 'Update Failed',
                description: error.response?.data?.message || 'Failed to update settings.',
                status: 'error',
                duration: 4000,
            })
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateTemplate = async (type) => {
        setUpdatingTemplate(prev => ({ ...prev, [type]: true }))
        try {
            const token = localStorage.getItem('token') // Assuming token is stored here
            // Direct fetch call since timeSettingsService doesn't have this method yet
            const response = await fetch(`/api/sheets/update-template/${type}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const result = await response.json();

            if (result.success) {
                toast({
                    title: 'Template Updated',
                    description: `${type.charAt(0).toUpperCase() + type.slice(1)} template has been refreshed from Master Sheet.`,
                    status: 'success',
                    duration: 3000,
                })
            } else {
                throw new Error(result.message)
            }
        } catch (error) {
            toast({
                title: 'Update Failed',
                description: error.message || 'Failed to update template.',
                status: 'error',
                duration: 4000,
            })
        } finally {
            setUpdatingTemplate(prev => ({ ...prev, [type]: false }))
        }
    }

    return (
        <Box p={8}>
            <PageHeader
                title="Time & Title Management"
                description="Configure application windows and award titles precisely"
            />

            <Container maxW="container.md" p={0}>
                <Card bg={bgColor} border="1px solid" borderColor={borderColor} shadow="xl" borderRadius="2xl">
                    <CardBody p={8}>
                        <form onSubmit={handleSubmit}>
                            <VStack spacing={8} align="stretch">
                                <Box>
                                    <HStack mb={4}>
                                        <Icon as={PencilIcon} boxSize={5} color="blue.500" />
                                        <Text fontSize="lg" fontWeight="bold">Award Identity</Text>
                                    </HStack>
                                    <FormControl isRequired>
                                        <FormLabel fontWeight="medium">Award Title</FormLabel>
                                        <Input
                                            name="title"
                                            value={formData.title}
                                            onChange={handleChange}
                                            placeholder="e.g. Trailblazer Awards 2026"
                                            size="lg"
                                            borderRadius="xl"
                                            _focus={{ borderColor: 'blue.400', boxShadow: '0 0 0 1px #4299E1' }}
                                        />
                                        <Text fontSize="xs" mt={2} color={textColor}>This title will appear at the top of the application forms for students.</Text>
                                    </FormControl>
                                </Box>

                                <Divider />

                                <Box>
                                    <HStack mb={4}>
                                        <Icon as={CalendarIcon} boxSize={5} color="green.500" />
                                        <Text fontSize="lg" fontWeight="bold">Application Dates</Text>
                                    </HStack>
                                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                                        <FormControl isRequired>
                                            <FormLabel fontWeight="medium">Start Date</FormLabel>
                                            <Input
                                                type="date"
                                                name="start_date"
                                                value={formData.start_date}
                                                onChange={handleChange}
                                                size="lg"
                                                borderRadius="xl"
                                            />
                                        </FormControl>
                                        <FormControl isRequired>
                                            <FormLabel fontWeight="medium">End Date</FormLabel>
                                            <Input
                                                type="date"
                                                name="end_date"
                                                value={formData.end_date}
                                                onChange={handleChange}
                                                size="lg"
                                                borderRadius="xl"
                                            />
                                        </FormControl>
                                    </SimpleGrid>
                                </Box>

                                <Divider />

                                <Box>
                                    <HStack mb={4}>
                                        <Icon as={ClockIcon} boxSize={5} color="orange.500" />
                                        <Text fontSize="lg" fontWeight="bold">Daily Time Window (Asia/Kolkata)</Text>
                                    </HStack>
                                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                                        <FormControl isRequired>
                                            <FormLabel fontWeight="medium">Opening Time</FormLabel>
                                            <Input
                                                type="time"
                                                name="start_time"
                                                value={formData.start_time}
                                                onChange={handleChange}
                                                size="lg"
                                                borderRadius="xl"
                                            />
                                        </FormControl>
                                        <FormControl isRequired>
                                            <FormLabel fontWeight="medium">Closing Time</FormLabel>
                                            <Input
                                                type="time"
                                                name="end_time"
                                                value={formData.end_time}
                                                onChange={handleChange}
                                                size="lg"
                                                borderRadius="xl"
                                            />
                                        </FormControl>
                                    </SimpleGrid>
                                </Box>

                                <Divider />

                                <Box>
                                    <HStack mb={4}>
                                        <Icon as={DocumentTextIcon} boxSize={5} color="purple.500" />
                                        <Text fontSize="lg" fontWeight="bold">Master Sheet Management</Text>
                                    </HStack>
                                    <Text fontSize="sm" color={textColor} mb={4}>
                                        Manage the core spreadsheet templates. Updates here will reflect for all new student sheets.
                                        First edit the Master Sheet in Google Drive, then click "Update Local Template" to apply changes.
                                    </Text>

                                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                                        {/* Sports Section */}
                                        <Card variant="outline" borderColor={borderColor}>
                                            <CardBody>
                                                <VStack align="stretch" spacing={3}>
                                                    <Text fontWeight="bold">Sports Master Sheet</Text>
                                                    <Button
                                                        as="a"
                                                        href="https://docs.google.com/spreadsheets/d/1QtdNCK8ENMU_ybRvY9g8IXX4MdClQ3-nvsBwArelSRQ"
                                                        target="_blank"
                                                        size="sm"
                                                        variant="link"
                                                        colorScheme="blue"
                                                        leftIcon={<Icon as={ArrowTopRightOnSquareIcon} />}
                                                    >
                                                        Edit Master Sheet (Drive)
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleUpdateTemplate('sports')}
                                                        isLoading={updatingTemplate.sports}
                                                        loadingText="Downloading..."
                                                        colorScheme="green"
                                                        size="sm"
                                                        variant="outline"
                                                    >
                                                        Update Local Template
                                                    </Button>
                                                </VStack>
                                            </CardBody>
                                        </Card>

                                        {/* Cultural Section */}
                                        <Card variant="outline" borderColor={borderColor}>
                                            <CardBody>
                                                <VStack align="stretch" spacing={3}>
                                                    <Text fontWeight="bold">Cultural Master Sheet</Text>
                                                    <Button
                                                        as="a"
                                                        href="https://docs.google.com/spreadsheets/d/1W5c-6KTh5KxZUZktriJdsHCeLwzGjmHu"
                                                        target="_blank"
                                                        size="sm"
                                                        variant="link"
                                                        colorScheme="blue"
                                                        leftIcon={<Icon as={ArrowTopRightOnSquareIcon} />}
                                                    >
                                                        Edit Master Sheet (Drive)
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleUpdateTemplate('cultural')}
                                                        isLoading={updatingTemplate.cultural}
                                                        loadingText="Downloading..."
                                                        colorScheme="pink"
                                                        size="sm"
                                                        variant="outline"
                                                    >
                                                        Update Local Template
                                                    </Button>
                                                </VStack>
                                            </CardBody>
                                        </Card>
                                    </SimpleGrid>
                                </Box>

                                <Button
                                    type="submit"
                                    size="xl"
                                    h="60px"
                                    bgGradient={bgGradient}
                                    color="white"
                                    fontSize="lg"
                                    fontWeight="bold"
                                    borderRadius="xl"
                                    _hover={{ opacity: 0.9, transform: 'translateY(-2px)' }}
                                    _active={{ transform: 'translateY(0)' }}
                                    isLoading={loading}
                                    loadingText="Updating System..."
                                >
                                    Save Global Settings
                                </Button>
                            </VStack>
                        </form>
                    </CardBody>
                </Card>
            </Container>
        </Box>
    )
}

export default TimeManagement
