import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Box, VStack, HStack, Text, Checkbox, Button, Input, Textarea,
    FormControl, FormLabel, Image, Icon, useColorModeValue, useDisclosure,
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
    ModalBody, ModalFooter, useToast, SimpleGrid, Alert, AlertIcon,
    CircularProgress, List, ListItem, Menu, MenuButton, MenuList, MenuItem,
    Container, ScaleFade, Fade, Divider, Badge
} from '@chakra-ui/react';
import { ChevronDownIcon, ArrowForwardIcon, CheckIcon as ChakraCheckIcon } from '@chakra-ui/icons';
import { FaMale, FaFemale, FaUser, FaCamera, FaTrophy, FaMusic, FaGraduationCap, FaChevronLeft } from 'react-icons/fa';
import PageHeader from '../components/layout/PageHeader';
import { formSubmissionService } from '../services/formSubmissionService';
import { formProcessingService } from '../services/formProcessingService';
import { authService } from '../services/authService';
import { positionService } from '../services/positionService';
import flameLogo from '../assets/img/FLAME.png';

const defaultProfilePhoto = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const MotionBox = motion(Box);
const MotionVStack = motion(VStack);
const MotionHStack = motion(HStack);

function ApplicationFormDashboard() {
    const toast = useToast();
    const { isOpen: isSportModalOpen, onOpen: onSportModalOpen, onClose: onSportModalClose } = useDisclosure();
    const { isOpen: isCulturalModalOpen, onOpen: onCulturalModalOpen, onClose: onCulturalModalClose } = useDisclosure();
    const { isOpen: isPhotoModalOpen, onOpen: onPhotoModalOpen, onClose: onPhotoModalClose } = useDisclosure();

    const bgColor = useColorModeValue('white', 'gray.800');
    const panelBg = useColorModeValue('gray.50', 'gray.700');
    const boxBorderColor = useColorModeValue('blue.200', 'blue.500');

    // State management
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isApplicationOpen, setIsApplicationOpen] = useState(true);
    const [appStatusMessage, setAppStatusMessage] = useState('');
    const [agreedToInstructions, setAgreedToInstructions] = useState(false);
    const [selectedRole, setSelectedRole] = useState(''); // trailblazer, sports_person, cultural_person
    const [submissionDone, setSubmissionDone] = useState(false);
    const [filledRoles, setFilledRoles] = useState([]);

    // Prefilled/Form Data
    const [formData, setFormData] = useState({
        name: '', studentId: '', mobileNumber: '', email: '',
        gender: '', batch: '', photoUrl: defaultProfilePhoto,
        academicLevel: '', position: '', cgpa: '', sportsRawScore: '',
        culturalRawScore: '', sportsScore: '', culturalScore: '',
        notOnProbation: false, trueStatement: false,
        sop: '', communityService: ''
    });

    // File states
    const [photoFile, setPhotoFile] = useState(null);
    const [sportFiles, setSportFiles] = useState([]);
    const [culturalFiles, setCulturalFiles] = useState([]);
    const [academicFiles, setAcademicFiles] = useState([]);

    const [positions, setPositions] = useState([]);

    const fetchStatusAndPrefill = async () => {
        try {
            // 1. Check Application Status
            const status = await formProcessingService.getApplicationStatus();
            setIsApplicationOpen(status.isOpen);
            setAppStatusMessage(status.message);

            if (status.isOpen) {
                // 2. Load Prefill Data
                const prefillData = await formProcessingService.getPrefillData();
                setFormData(prev => ({
                    ...prev,
                    ...prefillData.prefill,
                    photoUrl: prefillData.prefill.photo ? `https://flameawards.in:8082/photos/${prefillData.prefill.photo}` : defaultProfilePhoto
                }));
                setFilledRoles(prefillData.filledRoles || []);

                // 3. Load Positions
                const posResp = await positionService.getAll();
                setPositions(posResp.data || []);
            }
        } catch (err) {
            console.error('Initialization error:', err);
            toast({ title: 'System Error', description: 'Failed to initialize form. Please try again later.', status: 'error', duration: 5000 });
        }
    };

    useEffect(() => {
        const initForm = async () => {
            setLoading(true);
            await fetchStatusAndPrefill();
            setLoading(false);
        };
        initForm();
    }, [toast]);

    const handleRoleSelect = (role) => {
        setSelectedRole(role);
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setPhotoFile(file);
            setFormData(prev => ({ ...prev, photoUrl: URL.createObjectURL(file) }));
            onPhotoModalClose();
        }
    };

    const calculateScore = (value) => {
        const num = parseFloat(value);
        if (isNaN(num)) return '';
        if (num <= 100) return (num / 10).toFixed(1);
        return ((100 + (num - 100) * 0.05) / 10).toFixed(1);
    };

    const handleSubmission = async () => {
        // Basic Validation
        if (!formData.trueStatement) {
            toast({ title: 'Required', description: 'Please confirm that the information provided is accurate.', status: 'warning' });
            return;
        }

        const data = new FormData();
        data.append('selected_role', selectedRole);
        Object.keys(formData).forEach(key => {
            if (key !== 'photoUrl') data.append(key, formData[key]);
        });

        if (photoFile) data.append('photo', photoFile);
        sportFiles.forEach(file => data.append('sport_attachment', file));
        culturalFiles.forEach(file => data.append('cultural_attachment', file));
        academicFiles.forEach(file => data.append('academic_attachments', file));

        setSubmitting(true);
        try {
            await formSubmissionService.submit(data);
            setSubmissionDone(true);
            toast({ title: 'Success', description: 'Your application has been submitted successfully!', status: 'success' });
            // Refresh prefill to update filledRoles
            await fetchStatusAndPrefill();
        } catch (err) {
            toast({ title: 'Error', description: err.message, status: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading && !formData.name) return (
        <Container centerContent py={20} bg={bgColor} minH="100vh">
            <VStack spacing={4}>
                <CircularProgress isIndeterminate color="blue.500" size="60px" />
                <Text fontSize="lg" fontWeight="medium">Preparing your application...</Text>
            </VStack>
        </Container>
    );

    if (!isApplicationOpen) return (
        <Container centerContent py={20} bg={bgColor} minH="100vh">
            <MotionBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Alert status="error" variant="subtle" flexDirection="column" alignItems="center" justifyContent="center" textAlign="center" borderRadius="2xl" p={12} boxShadow="xl">
                    <AlertIcon boxSize="50px" mr={0} />
                    <Text mt={6} mb={2} fontSize="3xl" fontWeight="bold">{appStatusMessage || 'APPLICATION PERIOD HAS ENDED'}</Text>
                    <Text fontSize="lg" color="gray.600">The application window is currently closed. Please check back later.</Text>
                    <Button mt={8} size="lg" colorScheme="blue" variant="outline" onClick={() => authService.logout()}>Logout</Button>
                </Alert>
            </MotionBox>
        </Container>
    );

    if (submissionDone) return (
        <Container centerContent py={20} bg={bgColor} minH="100vh">
            <MotionBox initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 20 }}>
                <VStack spacing={8} p={12} bgGradient="linear(to-br, blue.600, blue.800)" color="white" borderRadius="3xl" textAlign="center" boxShadow="2xl" maxW="lg">
                    <Icon as={ChakraCheckIcon} boxSize={16} p={4} bg="whiteAlpha.300" borderRadius="full" />
                    <VStack spacing={4}>
                        <Text fontSize="4xl" fontWeight="bold">Congratulations!</Text>
                        <Text fontSize="lg" lineHeight="tall">Your application for the {selectedRole.replace('_', ' ').toUpperCase()} Award has been received. Our committee will review your documents.</Text>
                    </VStack>
                    <Divider borderColor="whiteAlpha.300" />
                    <VStack w="full" spacing={3}>
                        <Button size="lg" colorScheme="yellow" color="blue.800" fontWeight="bold" w="full" onClick={() => { setSubmissionDone(false); setSelectedRole(''); }}>Apply for Another Category</Button>
                        <Button size="lg" variant="outline" color="white" _hover={{ bg: 'whiteAlpha.200' }} w="full" onClick={() => authService.logout()}>Logout</Button>
                    </VStack>
                    <Text fontSize="sm" opacity={0.8}>You can securely logout or apply for more awards if eligible.</Text>
                </VStack>
            </MotionBox>
        </Container>
    );

    return (
        <Box p={{ base: 4, md: 8 }} bg={bgColor} minH="100vh">
            <PageHeader title="Trailblazer Awards 2024" description="Flame University's Most Prestigious Honors" />

            <AnimatePresence mode="wait">
                {!agreedToInstructions ? (
                    <MotionVStack key="instructions" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} spacing={8} align="stretch" mt={6}>
                        <Box p={{ base: 6, md: 10 }} borderRadius="2xl" bg={panelBg} borderWidth="1px" borderColor={boxBorderColor} boxShadow="sm">
                            <Text fontSize="2xl" fontWeight="bold" mb={6} color="blue.600">Important Instructions</Text>
                            <List spacing={5}>
                                <ListItem display="flex" alignItems="start">
                                    <Icon as={ChakraCheckIcon} color="green.500" mt={1} mr={3} />
                                    <Text><b>Formal Photograph:</b> A passport-sized formal photo is mandatory for all applicants.</Text>
                                </ListItem>
                                <ListItem display="flex" alignItems="start">
                                    <Icon as={ChakraCheckIcon} color="green.500" mt={1} mr={3} />
                                    <Text><b>Evidence & Proof:</b> For Sports/Cultural Person roles, you must provide verifiable proof and score sheets.</Text>
                                </ListItem>
                                <ListItem display="flex" alignItems="start">
                                    <Icon as={ChakraCheckIcon} color="green.500" mt={1} mr={3} />
                                    <Text><b>Trailblazer Role:</b> Requires a combined submission of both Sport and Cultural achievements.</Text>
                                </ListItem>
                                <ListItem display="flex" alignItems="start">
                                    <Icon as={ChakraCheckIcon} color="green.500" mt={1} mr={3} />
                                    <Text><b>Integrity:</b> Any false information provided will lead to immediate disqualification and disciplinary action.</Text>
                                </ListItem>
                            </List>
                            <Divider my={8} />
                            <Checkbox isChecked={agreedToInstructions} onChange={(e) => setAgreedToInstructions(e.target.checked)} colorScheme="blue" size="lg">
                                <Text fontSize="md" fontWeight="medium">I have read and understood the instructions and agree to provide accurate information.</Text>
                            </Checkbox>
                        </Box>
                        <Button h="60px" fontSize="lg" colorScheme="blue" isDisabled={!agreedToInstructions} onClick={() => setAgreedToInstructions(true)} rightIcon={<ArrowForwardIcon />}>Proceed to Application</Button>
                    </MotionVStack>
                ) : !selectedRole ? (
                    <MotionVStack key="role-selection" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} spacing={12} mt={12}>
                        <VStack spacing={2}>
                            <Text fontSize="3xl" fontWeight="black" textAlign="center">Identify Your Application Path</Text>
                            <Text fontSize="lg" color="gray.500" textAlign="center">Select the primary award category you are applying for</Text>
                        </VStack>
                        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8} w="full" maxW="1000px">
                            <RoleCard
                                title="Trailblazer"
                                description="Comprehensive excellence in both Sports and Culture."
                                icon={FaGraduationCap}
                                color="purple"
                                disabled={filledRoles.includes('Trailblazer')}
                                onClick={() => handleRoleSelect('trailblazer')}
                            />
                            <RoleCard
                                title="Sports Person"
                                description="Exceptional achievements and leadership in athletics."
                                icon={FaTrophy}
                                color="orange"
                                disabled={filledRoles.includes('Sports Person')}
                                onClick={() => handleRoleSelect('sports_person')}
                            />
                            <RoleCard
                                title="Cultural Person"
                                description="Outstanding contribution to arts, music, and culture."
                                icon={FaMusic}
                                color="pink"
                                disabled={filledRoles.includes('Cultural Person')}
                                onClick={() => handleRoleSelect('cultural_person')}
                            />
                        </SimpleGrid>
                    </MotionVStack>
                ) : (
                    <MotionVStack key="form-content" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} spacing={10} mt={8} align="stretch">
                        <HStack justify="space-between" align="center">
                            <Button leftIcon={<FaChevronLeft />} variant="ghost" onClick={() => setSelectedRole('')}>Change Role Path</Button>
                            <Badge colorScheme="blue" p={2} borderRadius="md" fontSize="md">Applying as: {selectedRole.replace('_', ' ').toUpperCase()}</Badge>
                        </HStack>

                        {/* User Profile Card */}
                        <Box p={{ base: 6, md: 8 }} borderRadius="2xl" bg={panelBg} borderWidth="1px" borderColor={boxBorderColor} boxShadow="sm">
                            <HStack spacing={8} align="center" flexWrap={{ base: 'wrap', md: 'nowrap' }}>
                                <Box position="relative">
                                    <Image src={formData.photoUrl} boxSize="150px" borderRadius="2xl" objectFit="cover" border="4px solid" borderColor="white" boxShadow="md" fallbackSrc={defaultProfilePhoto} />
                                    <Box position="absolute" bottom="-2" right="-2" bg="blue.500" p={3} borderRadius="xl" cursor="pointer" onClick={onPhotoModalOpen} boxShadow="lg" _hover={{ bg: 'blue.600', transform: 'scale(1.1)' }} transition="0.2s">
                                        <Icon as={FaCamera} color="white" />
                                    </Box>
                                </Box>
                                <VStack align="start" spacing={1} flex="1">
                                    <Text fontSize="3xl" fontWeight="black" color="gray.800">{formData.name || 'Student Name'}</Text>
                                    <HStack spacing={3} color="gray.600" fontSize="lg">
                                        <Icon as={FaUser} />
                                        <Text>{formData.studentId || 'ID'} | {formData.batch || 'Batch'}</Text>
                                    </HStack>
                                    <Text color="gray.500">{formData.email} • {formData.mobileNumber}</Text>
                                </VStack>
                                <Image src={flameLogo} alt="FLAME Logo" h="60px" opacity={0.6} display={{ base: 'none', sm: 'block' }} />
                            </HStack>
                        </Box>

                        <VStack spacing={10} align="stretch">
                            {/* Sport Section */}
                            {(selectedRole === 'trailblazer' || selectedRole === 'sports_person') && (
                                <Section title="Sports & Athletics Achievements">
                                    <VStack spacing={6} align="stretch">
                                        <FormControl isRequired>
                                            <FormLabel fontWeight="bold">Sports Score Calculation</FormLabel>
                                            <HStack spacing={4}>
                                                <Button leftIcon={<FaTrophy />} colorScheme="blue" variant="outline" onClick={onSportModalOpen}>Calculate Score</Button>
                                                <Input maxW="200px" placeholder="Enter raw score" value={formData.sportsRawScore} onChange={(e) => setFormData({ ...formData, sportsRawScore: e.target.value, sportsScore: calculateScore(e.target.value) })} />
                                                <Box px={4} py={2} bg="blue.50" borderRadius="md" border="1px solid" borderColor="blue.200">
                                                    <Text fontWeight="black" color="blue.700">Final: {formData.sportsScore || '0.0'}/10</Text>
                                                </Box>
                                            </HStack>
                                        </FormControl>
                                        <FormControl isRequired>
                                            <FormLabel fontWeight="bold">Sports Evidence (Certificates/Photos)</FormLabel>
                                            <Input type="file" multiple p={1} h="auto" borderStyle="dashed" onChange={(e) => setSportFiles(Array.from(e.target.files))} />
                                            <Text fontSize="xs" mt={1} color="gray.500">Upload all relevant proof of athletic achievements.</Text>
                                        </FormControl>
                                    </VStack>
                                </Section>
                            )}

                            {/* Cultural Section */}
                            {(selectedRole === 'trailblazer' || selectedRole === 'cultural_person') && (
                                <Section title="Cultural & Arts Excellence">
                                    <VStack spacing={6} align="stretch">
                                        <FormControl isRequired>
                                            <FormLabel fontWeight="bold">Cultural Score Calculation</FormLabel>
                                            <HStack spacing={4}>
                                                <Button leftIcon={<FaMusic />} colorScheme="pink" variant="outline" onClick={onCulturalModalOpen}>Calculate Score</Button>
                                                <Input maxW="200px" placeholder="Enter raw score" value={formData.culturalRawScore} onChange={(e) => setFormData({ ...formData, culturalRawScore: e.target.value, culturalScore: calculateScore(e.target.value) })} />
                                                <Box px={4} py={2} bg="pink.50" borderRadius="md" border="1px solid" borderColor="pink.200">
                                                    <Text fontWeight="black" color="pink.700">Final: {formData.culturalScore || '0.0'}/10</Text>
                                                </Box>
                                            </HStack>
                                        </FormControl>
                                        <FormControl isRequired>
                                            <FormLabel fontWeight="bold">Cultural Evidence (Proof/Media)</FormLabel>
                                            <Input type="file" multiple p={1} h="auto" borderStyle="dashed" onChange={(e) => setCulturalFiles(Array.from(e.target.files))} />
                                            <Text fontSize="xs" mt={1} color="gray.500">Upload certificates or media reflecting your artistic excellence.</Text>
                                        </FormControl>
                                    </VStack>
                                </Section>
                            )}

                            {/* Verification Section */}
                            <Box p={8} borderRadius="2xl" bg="gray.800" color="white" boxShadow="lg">
                                <Text fontSize="xl" fontWeight="bold" mb={6}>Final Declaration</Text>
                                <Divider mb={6} opacity={0.2} />
                                <VStack align="start" spacing={4}>
                                    <Checkbox isChecked={formData.notOnProbation} onChange={(e) => setFormData({ ...formData, notOnProbation: e.target.checked })} colorScheme="yellow">
                                        I am not currently on academic or disciplinary probation.
                                    </Checkbox>
                                    <Checkbox isChecked={formData.trueStatement} onChange={(e) => setFormData({ ...formData, trueStatement: e.target.checked })} colorScheme="yellow">
                                        I confirm all documents provided are true and accurate.
                                    </Checkbox>
                                </VStack>
                                <Button mt={10} size="lg" colorScheme="yellow" color="gray.900" fontWeight="black" w="full" h="70px" fontSize="xl" isLoading={submitting} loadingText="Submitting..." onClick={handleSubmission}>
                                    SUBMIT {selectedRole.replace('_', ' ').toUpperCase()} APPLICATION
                                </Button>
                            </Box>
                        </VStack>
                    </MotionVStack>
                )}
            </AnimatePresence>

            {/* Support Modals */}
            <Modal isOpen={isPhotoModalOpen} onClose={onPhotoModalClose} isCentered size="sm">
                <ModalOverlay backdropFilter="blur(5px)" />
                <ModalContent borderRadius="2xl">
                    <ModalHeader>Update Profile Photo</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody pb={8}>
                        <VStack spacing={4}>
                            <Box w="full" h="120px" p={6} border="2px dashed" borderColor="blue.200" borderRadius="xl" textAlign="center" _hover={{ borderColor: 'blue.400' }} cursor="pointer" position="relative">
                                <Input type="file" opacity={0} position="absolute" w="full" h="full" top={0} left={0} cursor="pointer" accept="image/*" onChange={handlePhotoChange} />
                                <Icon as={FaCamera} boxSize={8} color="blue.500" mb={2} />
                                <Text fontWeight="bold">Click to Upload</Text>
                                <Text fontSize="xs" color="gray.500">JPG, PNG (Max 2MB)</Text>
                            </Box>
                        </VStack>
                    </ModalBody>
                </ModalContent>
            </Modal>

            <Modal isOpen={isSportModalOpen} onClose={onSportModalClose} size="3xl" scrollBehavior="inside">
                <ModalOverlay />
                <ModalContent borderRadius="2xl">
                    <ModalHeader borderBottomWidth="1px">Sports Score Sheet</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody py={6}>
                        <VStack spacing={4} align="stretch" minH="400px" justify="center" bg="gray.50" borderRadius="xl">
                            <Text color="gray.500" textAlign="center">Dynamic Score Sheet Integration Pending...</Text>
                        </VStack>
                    </ModalBody>
                    <ModalFooter>
                        <Button colorScheme="blue" onClick={onSportModalClose}>Return to Form</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            <Modal isOpen={isCulturalModalOpen} onClose={onCulturalModalClose} size="3xl" scrollBehavior="inside">
                <ModalOverlay />
                <ModalContent borderRadius="2xl">
                    <ModalHeader borderBottomWidth="1px">Cultural Score Sheet</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody py={6}>
                        <VStack spacing={4} align="stretch" minH="400px" justify="center" bg="pink.50" borderRadius="xl">
                            <Text color="pink.400" textAlign="center">Dynamic Score Sheet Integration Pending...</Text>
                        </VStack>
                    </ModalBody>
                    <ModalFooter>
                        <Button colorScheme="pink" onClick={onCulturalModalClose}>Return to Form</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </Box>
    );
}

const RoleCard = ({ title, description, icon, color, onClick, disabled }) => {
    const colorMap = {
        purple: { bg: 'purple.50', border: 'purple.200', icon: 'purple.500', active: 'purple.400' },
        orange: { bg: 'orange.50', border: 'orange.200', icon: 'orange.500', active: 'orange.400' },
        pink: { bg: 'pink.50', border: 'pink.200', icon: 'pink.500', active: 'pink.400' }
    };
    const c = colorMap[color] || colorMap.purple;

    return (
        <VStack
            as="button"
            onClick={onClick}
            disabled={disabled}
            p={8}
            bg={disabled ? 'gray.50' : c.bg}
            borderWidth="2px"
            borderColor={disabled ? 'gray.200' : c.border}
            borderRadius="3xl"
            spacing={4}
            transition="all 0.3s"
            opacity={disabled ? 0.6 : 1}
            _hover={!disabled ? { transform: 'translateY(-8px)', boxShadow: 'xl', borderColor: c.active } : {}}
            position="relative"
            overflow="hidden"
            textAlign="center"
        >
            <Icon as={icon} boxSize={12} color={disabled ? 'gray.400' : c.icon} />
            <VStack spacing={1}>
                <Text fontWeight="black" fontSize="xl">{title}</Text>
                <Text fontSize="sm" color="gray.500">{description}</Text>
            </VStack>
            {disabled && (
                <Badge position="absolute" top={4} right={4} colorScheme="green" variant="solid">Submitted</Badge>
            )}
        </VStack>
    );
};

const Section = ({ title, children }) => (
    <Box>
        <Text fontSize="xl" fontWeight="black" mb={4} color="gray.700" px={2}>{title}</Text>
        <Box p={{ base: 6, md: 8 }} borderRadius="2xl" bg="white" borderWidth="1px" borderColor="gray.100" boxShadow="sm">
            {children}
        </Box>
    </Box>
);

export default ApplicationFormDashboard;
