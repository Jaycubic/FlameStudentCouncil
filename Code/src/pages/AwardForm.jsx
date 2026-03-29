// src/pages/AwardForm.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Box, VStack, HStack, Text, Checkbox, Button, Input, Textarea,
    FormControl, FormLabel, Image, Icon, useColorModeValue, useDisclosure,
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
    ModalBody, ModalFooter, useToast, SimpleGrid, Alert, AlertIcon,
    CircularProgress, List, ListItem, Menu, MenuButton, MenuList, MenuItem,
    Container, ScaleFade, Fade, Divider, Badge, FormHelperText, Spinner, Tooltip
} from '@chakra-ui/react';
import { ChevronDownIcon, ArrowForwardIcon, CheckIcon as ChakraCheckIcon } from '@chakra-ui/icons';
import { FaMale, FaFemale, FaUser, FaCamera, FaTrophy, FaMusic, FaGraduationCap, FaChevronLeft, FaFilePdf, FaPlus, FaTimes } from 'react-icons/fa';
import PageHeader from '../components/layout/PageHeader';
import { formSubmissionService } from '../services/formSubmissionService';
import { formProcessingService } from '../services/formProcessingService';
import { authService } from '../services/authService';
import { timeSettingsService } from '../services/timeSettingsService';
// positionService removed
import flameLogo from '../assets/img/FLAME.png';

const defaultProfilePhoto = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const MotionBox = motion(Box);
const MotionVStack = motion(VStack);
const MotionHStack = motion(HStack);

function ApplicationFormDashboard() {
    const navigate = useNavigate();
    const toast = useToast();
    const { isOpen: isSportModalOpen, onOpen: onSportModalOpen, onClose: onSportModalClose } = useDisclosure();
    const { isOpen: isCulturalModalOpen, onOpen: onCulturalModalOpen, onClose: onCulturalModalClose } = useDisclosure();
    const { isOpen: isPhotoModalOpen, onOpen: onPhotoModalOpen, onClose: onPhotoModalClose } = useDisclosure();

    const bgColor = useColorModeValue('white', 'gray.800');
    const panelBg = useColorModeValue('gray.50', 'gray.700');
    const boxBorderColor = useColorModeValue('blue.200', 'blue.500');
    const textColor = useColorModeValue('gray.800', 'white');
    const secondaryTextColor = useColorModeValue('gray.600', 'gray.300');
    const mutedTextColor = useColorModeValue('gray.500', 'gray.400');

    // State management
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isApplicationOpen, setIsApplicationOpen] = useState(true);
    const [appStatusMessage, setAppStatusMessage] = useState('');
    const [agreedToInstructions, setAgreedToInstructions] = useState(false);
    const [selectedRole, setSelectedRole] = useState(''); // trailblazer, sports_person, cultural_person
    const [submissionDone, setSubmissionDone] = useState(false);
    const [filledRoles, setFilledRoles] = useState([]);
    const [allCompleted, setAllCompleted] = useState(false);
    const [timeSettings, setTimeSettings] = useState(null);
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    const [timerStatus, setTimerStatus] = useState('Checking...'); // 'Opening In', 'Closing In', 'Closed'

    // Prefilled/Form Data
    const [formData, setFormData] = useState({
        name: '', studentId: '', mobileNumber: '', email: '',
        gender: '', batch: '', photoUrl: defaultProfilePhoto,
        academicLevel: '', cgpa: '', sportsRawScore: '',
        culturalRawScore: '', sportsScore: '', culturalScore: '',
        notOnProbation: false, trueStatement: false,
        sop: '', communityService: ''
    });

    // File states
    const [photoFile, setPhotoFile] = useState(null);
    const [sportFiles, setSportFiles] = useState([]);
    const [culturalFiles, setCulturalFiles] = useState([]);
    const [academicFiles, setAcademicFiles] = useState([]);
    const [generatingSheet, setGeneratingSheet] = useState({ sports: false, cultural: false });
    const [sheetReady, setSheetReady] = useState({ sports: null, cultural: null });
    const sportFileRef = useRef(null);
    const culturalFileRef = useRef(null);
    const pollingRef = useRef(null);

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    const PHOTO_MAX_SIZE = 5 * 1024 * 1024; // 5MB for photo

    const [photoExists, setPhotoExists] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    const fetchStatusAndPrefill = async () => {
        try {
            // 1. Fetch Time Settings & Title
            const timeRes = await timeSettingsService.getSettings();
            let currentSettings = null;
            if (timeRes.success && timeRes.data) {
                currentSettings = timeRes.data;
                setTimeSettings(currentSettings);
            }

            // 2. Load Prefill Data
            const prefillData = await formProcessingService.getPrefillData();
            const p = prefillData.prefill;
            const sid = p.student_id;
            const photoName = p.photo || sid;
            setFormData(prev => ({
                ...prev,
                name:          p.name          || prev.name,
                studentId:     p.student_id    || prev.studentId,    // snake → camel
                mobileNumber:  p.mobile_number  || prev.mobileNumber, // snake → camel
                email:         p.email         || prev.email,
                gender:        p.gender        || prev.gender,
                batch:         p.batch         || prev.batch,
                photoUrl: prefillData.photoExists && photoName
                    ? `/api/photos/${photoName}?t=${Date.now()}`
                    : defaultProfilePhoto
            }));
            setPhotoExists(prefillData.photoExists);

            const roles = prefillData.filledRoles || [];
            setFilledRoles(roles);
            if (roles.length >= 3) {
                setAllCompleted(true);
            }

            // 3. Restore saved form state from localStorage
            const savedAgreed = localStorage.getItem('awardForm_agreed');
            const savedRole = localStorage.getItem('awardForm_role');
            if (savedAgreed === 'true') setAgreedToInstructions(true);
            if (savedRole && !roles.includes(savedRole.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()))) {
                setSelectedRole(savedRole);
            }

            // 4. Determine Application Access based on Time Settings
            if (currentSettings && currentSettings.start_date) {
                const now = new Date();
                const startDate = new Date(`${currentSettings.start_date}T${currentSettings.start_time}`);
                const endDate = new Date(`${currentSettings.end_date}T${currentSettings.end_time}`);

                if (now < startDate) {
                    setIsApplicationOpen(false);
                    setAppStatusMessage('The Application Form has not yet opened.');
                } else if (now > endDate) {
                    setIsApplicationOpen(false);
                    setAppStatusMessage('The Application window is now closed.');
                } else {
                    setIsApplicationOpen(true);
                }
            } else {
                setIsApplicationOpen(false);
                setAppStatusMessage('The Form has not yet opened. (Settings missing)');
            }
        } catch (err) {
            console.error('Initialization error:', err);
            toast({ title: 'System Error', description: 'Failed to initialize form. Please try again later.', status: 'error', duration: 5000 });
        }
    };

    useEffect(() => {
        const calculateTimeLeft = () => {
            if (!timeSettings) return;

            const now = new Date();
            const startDate = new Date(`${timeSettings.start_date}T${timeSettings.start_time}`);
            const endDate = new Date(`${timeSettings.end_date}T${timeSettings.end_time}`);

            let targetDate = null;
            if (now < startDate) {
                setTimerStatus('Opening In');
                targetDate = startDate;
            } else if (now <= endDate) {
                setTimerStatus('Closing In');
                targetDate = endDate;
            } else {
                setTimerStatus('Closed');
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
                return;
            }

            const difference = targetDate - now;
            if (difference > 0) {
                setTimeLeft({
                    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                    minutes: Math.floor((difference / 1000 / 60) % 60),
                    seconds: Math.floor((difference / 1000) % 60)
                });
            } else {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
            }
        };

        const timer = setInterval(calculateTimeLeft, 1000);
        calculateTimeLeft(); // initial call
        return () => clearInterval(timer);
    }, [timeSettings]);

    useEffect(() => {
        const initForm = async () => {
            setLoading(true);
            await fetchStatusAndPrefill();
            setLoading(false);
        };
        initForm();

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [toast]);

    useEffect(() => {
        return () => {
            if (formData.photoUrl?.startsWith('blob:')) {
                URL.revokeObjectURL(formData.photoUrl);
            }
        };
    }, [formData.photoUrl]);

    const handleRoleSelect = (role, title) => {
        if (filledRoles.includes(title)) {
            toast({
                title: 'Already Submitted',
                description: `You have already applied for the ${title} Award.`,
                status: 'info',
                duration: 3000,
                isClosable: true,
            });
            return;
        }
        setSelectedRole(role);
        localStorage.setItem('awardForm_role', role);
    };

    const handlePhotoChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // ── 5MB size guard ──
        if (file.size > PHOTO_MAX_SIZE) {
            toast({
                title: 'Photo Too Large',
                description: 'Maximum allowed photo size is 5MB. Please compress or choose a smaller image.',
                status: 'error',
                duration: 6000,
                isClosable: true,
            });
            return;
        }

        // Show preview immediately (blob URL)
        const blobUrl = URL.createObjectURL(file);
        setPhotoFile(file);
        setFormData(prev => ({ ...prev, photoUrl: blobUrl }));

        // Upload to server NOW — before form submit
        setUploadingPhoto(true);
        try {
            const uploadResult = await formProcessingService.uploadPhoto(file, formData.studentId || formData.student_id);
            setPhotoExists(true);
            // Use the exact filename (with extension) returned by server — avoids guessing
            const exactFilename = uploadResult?.filename;
            const photoUrl = exactFilename
                ? `/api/photos/${exactFilename}?t=${Date.now()}`
                : `/api/photos/${formData.studentId || formData.student_id}?t=${Date.now()}`;
            setFormData(prev => ({ ...prev, photoUrl }));
            toast({ title: '✅ Photo Uploaded', description: 'Your profile photo has been saved. You may now fill the rest of the form.', status: 'success', duration: 4000 });
            onPhotoModalClose();
        } catch (err) {
            // Revert preview on failure
            setPhotoFile(null);
            setFormData(prev => ({ ...prev, photoUrl: defaultProfilePhoto }));
            toast({ title: 'Upload Failed', description: err.message, status: 'error', duration: 5000 });
        } finally {
            setUploadingPhoto(false);
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
        if (!photoExists && !photoFile) {
            toast({ title: 'Photo Required', description: 'Please upload a profile photo before submitting.', status: 'warning' });
            return;
        }
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
            localStorage.removeItem('awardForm_role'); // Clear saved role after submission
            toast({ title: 'Success', description: 'Your application has been submitted successfully!', status: 'success' });
            // Refresh prefill to update filledRoles
            await fetchStatusAndPrefill();
        } catch (err) {
            toast({ title: 'Error', description: err.message, status: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleGenerateSheet = async (type) => {
        setGeneratingSheet(prev => ({ ...prev, [type]: true }));
        try {
            const deviceId = localStorage.getItem('deviceId') || '';
            const response = await fetch(`/api/sheets/${type}`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-id': deviceId
                }
            });

            const result = await response.json();

            // Fast path — sheet ready immediately
            if (result.success && result.url) {
                setSheetReady(prev => ({ ...prev, [type]: result.url }));
                toast({ title: 'Ready!', description: 'Your Matrix Sheet is ready. Click the button to open it.', status: 'success' });
                return;
            }

            // Queue path — poll for completion
            if (response.status === 202 && result.jobId) {
                toast({ title: 'Processing', description: 'Server is busy — your sheet is queued. Please wait...', status: 'info', duration: 5000 });
                const sheetUrl = await pollJobStatus(result.jobId);
                setSheetReady(prev => ({ ...prev, [type]: sheetUrl }));
                toast({ title: 'Ready!', description: 'Your Matrix Sheet is ready. Click the button to open it.', status: 'success' });
                return;
            }

            throw new Error(result.message || 'Failed to generate sheet');
        } catch (error) {
            console.error('Sheet generation error:', error);
            toast({ title: 'Error', description: error.message, status: 'error' });
        } finally {
            setGeneratingSheet(prev => ({ ...prev, [type]: false }));
        }
    };

    // Poll BullMQ job status every 3s until completed or failed
    const pollJobStatus = (jobId) => {
        return new Promise((resolve, reject) => {
            const deviceId = localStorage.getItem('deviceId') || '';
            let attempts = 0;
            const maxAttempts = 40; // 40 × 3s = 2 minutes max

            pollingRef.current = setInterval(async () => {
                attempts++;
                try {
                    const res = await fetch(`/api/sheets/job/${jobId}`, {
                        credentials: 'include',
                        headers: { 'x-device-id': deviceId }
                    });
                    const data = await res.json();

                    if (data.status === 'completed' && data.url) {
                        clearInterval(pollingRef.current);
                        resolve(data.url);
                    } else if (data.status === 'failed') {
                        clearInterval(pollingRef.current);
                        reject(new Error(data.error || 'Sheet generation failed'));
                    } else if (attempts >= maxAttempts) {
                        clearInterval(pollingRef.current);
                        reject(new Error('Sheet generation timed out. Please try again.'));
                    }
                    // else: still 'waiting' or 'active' — keep polling
                } catch (err) {
                    clearInterval(pollingRef.current);
                    reject(err);
                }
            }, 3000);
        });
    };

    const openSportFilePicker = () => {
        if (sportFileRef.current) {
            sportFileRef.current.value = ''; // reset BEFORE click
            sportFileRef.current.click();
        }
    };

    const openCulturalFilePicker = () => {
        if (culturalFileRef.current) {
            culturalFileRef.current.value = ''; // reset BEFORE click
            culturalFileRef.current.click();
        }
    };

    const handleApplyAnother = async () => {
        setSubmissionDone(false);
        setSelectedRole('');
        setSportFiles([]);
        setCulturalFiles([]);
        setAcademicFiles([]);
        setGeneratingSheet({ sports: false, cultural: false });
        setSheetReady({ sports: null, cultural: null });
        setFormData(prev => ({
            ...prev,
            trueStatement: false,
            notOnProbation: false
        }));
        // Re-fetch to ensure filledRoles is perfectly up to date
        await fetchStatusAndPrefill();
    };

    if (loading && !formData.name) return (
        <Container centerContent py={20} bg={bgColor} minH="100vh">
            <VStack spacing={4}>
                <CircularProgress isIndeterminate color="blue.500" size="60px" />
                <Text fontSize="lg" fontWeight="medium">Preparing your application...</Text>
            </VStack>
        </Container>
    );

    if (allCompleted) return (
        <Container centerContent py={20} bg={bgColor} minH="100vh">
            <MotionBox initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 20 }}>
                <VStack spacing={10} p={{ base: 8, md: 16 }} bgGradient="linear(to-br, green.500, green.700)" color="white" borderRadius="3xl" textAlign="center" boxShadow="2xl" maxW="xl">
                    <Box bg="whiteAlpha.200" p={6} borderRadius="full">
                        <Icon as={ChakraCheckIcon} boxSize={20} />
                    </Box>
                    <VStack spacing={4}>
                        <Text fontSize={{ base: "3xl", md: "5xl" }} fontWeight="black">All Done!</Text>
                        <Text fontSize="xl" opacity={0.9} lineHeight="tall">You have successfully submitted applications for all award categories: <b>Trailblazer, Sports Person, and Cultural Person</b>.</Text>
                    </VStack>
                    <Divider borderColor="whiteAlpha.300" />
                    <VStack w="full" spacing={6}>
                        <Text fontSize="md" fontStyle="italic">"Excellence is not an act, but a habit." - Aristotle</Text>
                        <Button size="lg" variant="solid" colorScheme="whiteAlpha" bg="white" color="green.700" _hover={{ bg: 'gray.100' }} w="full" h="70px" fontSize="xl" fontWeight="bold" onClick={() => { authService.logout(); navigate('/login'); }}>LOGOUT SECURELY</Button>
                    </VStack>
                </VStack>
            </MotionBox>
        </Container>
    );

    if (!isApplicationOpen) return (
        <Container centerContent py={20} bg={bgColor} minH="100vh">
            <MotionBox initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Alert status="error" variant="subtle" flexDirection="column" alignItems="center" justifyContent="center" textAlign="center" borderRadius="2xl" p={12} boxShadow="xl">
                    <AlertIcon boxSize="50px" mr={0} />
                    <Text mt={6} mb={2} fontSize="3xl" fontWeight="bold">{appStatusMessage || 'APPLICATION PERIOD HAS ENDED'}</Text>
                    <Text fontSize="lg" color={secondaryTextColor}>The application window is currently closed. Please check back later.</Text>
                    <Button mt={8} size="lg" colorScheme="blue" variant="outline" onClick={() => { authService.logout(); navigate('/login'); }}>Logout</Button>
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
                        <Button size="lg" colorScheme="yellow" color="blue.800" fontWeight="bold" w="full" onClick={handleApplyAnother}>Apply for Another Category</Button>
                        <Button size="lg" variant="outline" color="white" _hover={{ bg: 'whiteAlpha.200' }} w="full" onClick={() => { authService.logout(); navigate('/login'); }}>Logout</Button>
                    </VStack>
                    <Text fontSize="sm" opacity={0.8}>You can securely logout or apply for more awards if eligible.</Text>
                </VStack>
            </MotionBox>
        </Container>
    );

    return (
        <Box p={{ base: 3, md: 8 }} bg={bgColor} minH="100vh" position="relative">
            {/* Real-time Countdown UI — static on mobile, absolute on desktop */}
            <Box
                position={{ base: 'static', md: 'absolute' }}
                top={{ md: 6 }}
                right={{ md: 8 }}
                zIndex={10}
                mb={{ base: 2, md: 0 }}
                display="flex"
                justifyContent={{ base: 'center', md: 'flex-end' }}
            >
                <HStack spacing={2} bg={useColorModeValue('white', 'gray.700')} p={{ base: 2, md: 3 }} borderRadius="xl" boxShadow="md" border="1px solid" borderColor={boxBorderColor}>
                    <VStack spacing={0} align="end">
                        <Text fontSize={{ base: '2xs', md: 'xs' }} fontWeight="bold" color="blue.500" textTransform="uppercase">{timerStatus}</Text>
                        <HStack spacing={1} fontWeight="black" fontSize={{ base: 'sm', md: 'lg' }} color={textColor}>
                            <Text>{String(timeLeft.days).padStart(2, '0')}d</Text>
                            <Text>:</Text>
                            <Text>{String(timeLeft.hours).padStart(2, '0')}h</Text>
                            <Text>:</Text>
                            <Text>{String(timeLeft.minutes).padStart(2, '0')}m</Text>
                            <Text>:</Text>
                            <Text color="blue.500">{String(timeLeft.seconds).padStart(2, '0')}s</Text>
                        </HStack>
                    </VStack>
                </HStack>
            </Box>

            <PageHeader title={timeSettings?.title || "Trailblazer Awards"} description="Flame University's Most Prestigious Honors" />

            <AnimatePresence mode="wait">
                {!agreedToInstructions ? (
                    <MotionVStack key="instructions" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} spacing={8} align="stretch" mt={6}>
                        <Box p={{ base: 6, md: 10 }} borderRadius="2xl" bg={panelBg} borderWidth="1px" borderColor={boxBorderColor} boxShadow="sm">
                            <Text fontSize={{ base: 'lg', md: '2xl' }} fontWeight="bold" mb={{ base: 4, md: 6 }} color="blue.600">Important Instructions</Text>
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
                            <Checkbox isChecked={agreedToInstructions} onChange={(e) => { setAgreedToInstructions(e.target.checked); localStorage.setItem('awardForm_agreed', e.target.checked); }} colorScheme="blue" size="lg">
                                <Text fontSize="md" fontWeight="medium">I have read and understood the instructions and agree to provide accurate information.</Text>
                            </Checkbox>
                        </Box>
                        <Button h={{ base: '50px', md: '60px' }} fontSize={{ base: 'md', md: 'lg' }} colorScheme="blue" isDisabled={!agreedToInstructions} onClick={() => { setAgreedToInstructions(true); localStorage.setItem('awardForm_agreed', 'true'); }} rightIcon={<ArrowForwardIcon />}>Proceed to Application</Button>
                    </MotionVStack>
                ) : !selectedRole ? (
                    <MotionVStack key="role-selection" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} spacing={{ base: 6, md: 12 }} mt={{ base: 6, md: 12 }}>
                        <VStack spacing={2}>
                            <Text fontSize={{ base: 'xl', md: '3xl' }} fontWeight="black" textAlign="center">Identify Your Application Path</Text>
                            <Text fontSize={{ base: 'sm', md: 'lg' }} color={mutedTextColor} textAlign="center">Select the primary award category you are applying for</Text>
                        </VStack>
                        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8} w="full" maxW="1000px">
                            <RoleCard
                                title="Trailblazer"
                                description="Comprehensive excellence in both Sports and Culture."
                                icon={FaGraduationCap}
                                color="purple"
                                disabled={filledRoles.includes('Trailblazer')}
                                onClick={() => handleRoleSelect('trailblazer', 'Trailblazer')}
                            />
                            <RoleCard
                                title="Sports Person"
                                description="Exceptional achievements and leadership in athletics."
                                icon={FaTrophy}
                                color="orange"
                                disabled={filledRoles.includes('Sports Person')}
                                onClick={() => handleRoleSelect('sports_person', 'Sports Person')}
                            />
                            <RoleCard
                                title="Cultural Person"
                                description="Outstanding contribution to arts, music, and culture."
                                icon={FaMusic}
                                color="pink"
                                disabled={filledRoles.includes('Cultural Person')}
                                onClick={() => handleRoleSelect('cultural_person', 'Cultural Person')}
                            />
                        </SimpleGrid>
                    </MotionVStack>
                ) : (
                    <MotionVStack key="form-content" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} spacing={{ base: 5, md: 10 }} mt={{ base: 4, md: 8 }} align="stretch">
                        <VStack spacing={2} align="stretch">
                            <HStack justify="space-between" align="center" flexWrap="wrap" gap={2}>
                                <Button leftIcon={<FaChevronLeft />} variant="ghost" size={{ base: 'sm', md: 'md' }} onClick={() => setSelectedRole('')}>Change Role</Button>
                                <Badge colorScheme="blue" p={{ base: 1.5, md: 2 }} borderRadius="md" fontSize={{ base: 'xs', md: 'md' }}>Applying as: {selectedRole.replace('_', ' ').toUpperCase()}</Badge>
                            </HStack>
                        </VStack>

                        {/* User Profile Card */}
                        <Box p={{ base: 4, md: 8 }} borderRadius="2xl" bg={panelBg} borderWidth="1px" borderColor={boxBorderColor} boxShadow="sm">
                            <HStack spacing={{ base: 4, md: 8 }} align="center" flexWrap={{ base: 'wrap', md: 'nowrap' }}>
                                <Box position="relative" mx={{ base: 'auto', md: 0 }}>
                                    <Image src={formData.photoUrl} boxSize={{ base: '100px', md: '150px' }} borderRadius="2xl" objectFit="cover" border="4px solid" borderColor={photoExists ? 'green.300' : 'red.300'} boxShadow="md" fallbackSrc={defaultProfilePhoto} />
                                    {!photoExists && (
                                        <Box position="absolute" bottom="-2" right="-2" bg="red.500" p={3} borderRadius="xl" cursor="pointer" onClick={onPhotoModalOpen} boxShadow="lg" _hover={{ bg: 'red.600', transform: 'scale(1.1)' }} transition="0.2s">
                                            <Icon as={FaCamera} color="white" />
                                        </Box>
                                    )}
                                </Box>
                                <VStack align="start" spacing={1} flex="1" w={{ base: 'full', md: 'auto' }}>
                                    <Text fontSize={{ base: 'xl', md: '3xl' }} fontWeight="black" color={textColor}>{formData.name || 'Student Name'}</Text>
                                    <HStack spacing={{ base: 2, md: 3 }} color={secondaryTextColor} fontSize={{ base: 'sm', md: 'lg' }}>
                                        <Icon as={FaUser} />
                                        <Text>{formData.gender || 'Gender'} | {formData.student_id || 'ID'} | {formData.batch || 'Batch'}</Text>
                                    </HStack>
                                    <Text color={mutedTextColor} fontSize={{ base: 'xs', md: 'md' }}>{formData.email} • {formData.mobile_number}</Text>
                                    {!photoExists && (
                                        <Alert status="error" borderRadius="lg" mt={2} py={2} px={3}>
                                            <AlertIcon />
                                            <Text fontSize="sm" fontWeight="bold">Profile photo is mandatory. Please click the camera icon to upload.</Text>
                                        </Alert>
                                    )}
                                </VStack>
                                <Image src={flameLogo} alt="FLAME Logo" h="60px" opacity={0.6} display={{ base: 'none', sm: 'block' }} />
                            </HStack>
                        </Box>

                        {/* ── Photo Gate Overlay ── */}
                        <Box position="relative">
                            {/* Greyed-out click-interceptor — only when photo is missing */}
                            {!photoExists && (
                                <Box
                                    position="absolute"
                                    top={0} left={0} right={0} bottom={0}
                                    zIndex={10}
                                    borderRadius="2xl"
                                    bg="blackAlpha.100"
                                    backdropFilter="blur(2px)"
                                    cursor="not-allowed"
                                    onClick={() => {
                                        toast({
                                            title: '📸 Upload Photo First',
                                            description: 'A profile photo is mandatory before you can fill this section.',
                                            status: 'warning',
                                            duration: 4000,
                                            isClosable: true,
                                        });
                                        onPhotoModalOpen();
                                    }}
                                />
                            )}

                        <VStack spacing={10} align="stretch" opacity={photoExists ? 1 : 0.45} pointerEvents={photoExists ? 'auto' : 'none'}>
                            {/* Sport Section */}
                            {(selectedRole === 'trailblazer' || selectedRole === 'sports_person') && (
                                <Section title="Sports & Athletics Achievements">
                                    <VStack spacing={0} align="stretch">
                                        {/* Step 1: Generate / Open Matrix Sheet */}
                                        <HStack spacing={4} align="start">
                                            <VStack spacing={0} align="center" minW="32px">
                                                <Box w="32px" h="32px" borderRadius="full" bg="blue.500" color="white" display="flex" alignItems="center" justifyContent="center" fontWeight="bold" fontSize="sm">1</Box>
                                                <Box w="2px" h="40px" bg="blue.200" />
                                            </VStack>
                                            <VStack align="start" spacing={2} pb={4} flex="1">
                                                <Text fontWeight="bold" fontSize="sm">Open your Sports Matrix Sheet</Text>
                                                <Text fontSize="xs" color={mutedTextColor}>Fill in your achievements in the standardized spreadsheet.</Text>
                                                {generatingSheet.sports ? (
                                                    <HStack spacing={3} p={3} bg="blue.50" borderRadius="lg" w="full">
                                                        <CircularProgress isIndeterminate size="24px" color="blue.500" />
                                                        <VStack align="start" spacing={0}>
                                                            <Text fontSize="xs" fontWeight="bold" color="blue.700">Preparing your Matrix Sheet...</Text>
                                                            <Text fontSize="2xs" color="blue.500">This may take a few seconds</Text>
                                                        </VStack>
                                                    </HStack>
                                                ) : sheetReady.sports ? (
                                                    <Button
                                                        leftIcon={<Icon as={FaTrophy} />}
                                                        colorScheme="green"
                                                        variant="solid"
                                                        size="sm"
                                                        onClick={() => window.open(sheetReady.sports, '_blank')}
                                                    >
                                                        Open Sports Matrix Sheet
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        leftIcon={<Icon as={FaTrophy} />}
                                                        colorScheme="blue"
                                                        variant="solid"
                                                        size="sm"
                                                        onClick={() => handleGenerateSheet('sports')}
                                                    >
                                                        Generate Sports Matrix Sheet
                                                    </Button>
                                                )}
                                            </VStack>
                                        </HStack>
                                        {/* Step 2: Upload Evidence */}
                                        <HStack spacing={4} align="start">
                                            <VStack spacing={0} align="center" minW="32px">
                                                <Box w="32px" h="32px" borderRadius="full" bg="blue.500" color="white" display="flex" alignItems="center" justifyContent="center" fontWeight="bold" fontSize="sm">2</Box>
                                            </VStack>
                                            <VStack align="start" spacing={3} flex="1">
                                                <Text fontWeight="bold" fontSize="sm">Upload Supporting Documents (PDF)</Text>
                                                <input ref={sportFileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={(e) => {
                                                    const files = Array.from(e.target.files || []);
                                                    if (files.length === 0) {
                                                        console.warn('No sport files selected'); // DEBUG
                                                        return;
                                                    }

                                                    const validFiles = files.filter(file => {
                                                        if (file.size > MAX_SIZE) {
                                                            toast({
                                                                title: 'File too large',
                                                                description: `${file.name} exceeds 5MB limit`,
                                                                status: 'error'
                                                            });
                                                            return false;
                                                        }
                                                        return true;
                                                    });

                                                    if (validFiles.length > 0) {
                                                        console.log('Sport file input triggered', validFiles);
                                                        setSportFiles(prev => {
                                                            const newFiles = validFiles.filter(
                                                                f => !prev.some(p => p.name === f.name && p.size === f.size)
                                                            );
                                                            return [...prev, ...newFiles];
                                                        });
                                                    }
                                                    // reset AFTER processing
                                                    e.target.value = '';
                                                }} multiple />
                                                <Button leftIcon={<FaPlus />} size="sm" variant="outline" colorScheme="blue" onClick={openSportFilePicker}>Add PDF Files</Button>
                                                {sportFiles.length > 0 && (
                                                    <VStack align="stretch" spacing={2} w="full">
                                                        {sportFiles.map((file, i) => (
                                                            <HStack key={i} p={2} bg="blue.50" borderRadius="lg" border="1px solid" borderColor="blue.100" justify="space-between">
                                                                <HStack spacing={2} overflow="hidden">
                                                                    <Icon as={FaFilePdf} color="red.400" flexShrink={0} />
                                                                    <Text fontSize="xs" fontWeight="medium" isTruncated>{file.name}</Text>
                                                                    <Text fontSize="2xs" color={mutedTextColor} flexShrink={0}>({(file.size / 1024).toFixed(0)} KB)</Text>
                                                                </HStack>
                                                                <Box as="button" onClick={() => setSportFiles(prev => prev.filter((_, idx) => idx !== i))} p={1} borderRadius="md" _hover={{ bg: 'red.100' }}>
                                                                    <Icon as={FaTimes} color="red.400" boxSize={3} />
                                                                </Box>
                                                            </HStack>
                                                        ))}
                                                    </VStack>
                                                )}
                                            </VStack>
                                        </HStack>
                                    </VStack>
                                </Section>
                            )}

                            {/* Cultural Section */}
                            {(selectedRole === 'trailblazer' || selectedRole === 'cultural_person') && (
                                <Section title="Cultural & Arts Excellence">
                                    <VStack spacing={0} align="stretch">
                                        {/* Step 1: Generate / Open Matrix Sheet */}
                                        <HStack spacing={4} align="start">
                                            <VStack spacing={0} align="center" minW="32px">
                                                <Box w="32px" h="32px" borderRadius="full" bg="pink.500" color="white" display="flex" alignItems="center" justifyContent="center" fontWeight="bold" fontSize="sm">1</Box>
                                                <Box w="2px" h="40px" bg="pink.200" />
                                            </VStack>
                                            <VStack align="start" spacing={2} pb={4} flex="1">
                                                <Text fontWeight="bold" fontSize="sm">Open your Cultural Matrix Sheet</Text>
                                                <Text fontSize="xs" color={mutedTextColor}>Fill in your achievements in the standardized spreadsheet.</Text>
                                                {generatingSheet.cultural ? (
                                                    <HStack spacing={3} p={3} bg="pink.50" borderRadius="lg" w="full">
                                                        <CircularProgress isIndeterminate size="24px" color="pink.500" />
                                                        <VStack align="start" spacing={0}>
                                                            <Text fontSize="xs" fontWeight="bold" color="pink.700">Preparing your Matrix Sheet...</Text>
                                                            <Text fontSize="2xs" color="pink.500">This may take a few seconds</Text>
                                                        </VStack>
                                                    </HStack>
                                                ) : sheetReady.cultural ? (
                                                    <Button
                                                        leftIcon={<Icon as={FaMusic} />}
                                                        colorScheme="green"
                                                        variant="solid"
                                                        size="sm"
                                                        onClick={() => window.open(sheetReady.cultural, '_blank')}
                                                    >
                                                        Open Cultural Matrix Sheet
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        leftIcon={<Icon as={FaMusic} />}
                                                        colorScheme="pink"
                                                        variant="solid"
                                                        size="sm"
                                                        onClick={() => handleGenerateSheet('cultural')}
                                                    >
                                                        Generate Cultural Matrix Sheet
                                                    </Button>
                                                )}
                                            </VStack>
                                        </HStack>
                                        {/* Step 2: Upload Evidence */}
                                        <HStack spacing={4} align="start">
                                            <VStack spacing={0} align="center" minW="32px">
                                                <Box w="32px" h="32px" borderRadius="full" bg="pink.500" color="white" display="flex" alignItems="center" justifyContent="center" fontWeight="bold" fontSize="sm">2</Box>
                                            </VStack>
                                            <VStack align="start" spacing={3} flex="1">
                                                <Text fontWeight="bold" fontSize="sm">Upload Supporting Documents (PDF)</Text>
                                                <input ref={culturalFileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={(e) => {
                                                    const files = Array.from(e.target.files || []);
                                                    if (files.length === 0) {
                                                        console.warn('No cultural files selected'); // DEBUG
                                                        return;
                                                    }

                                                    const validFiles = files.filter(file => {
                                                        if (file.size > MAX_SIZE) {
                                                            toast({
                                                                title: 'File too large',
                                                                description: `${file.name} exceeds 5MB limit`,
                                                                status: 'error'
                                                            });
                                                            return false;
                                                        }
                                                        return true;
                                                    });

                                                    if (validFiles.length > 0) {
                                                        console.log('Cultural file input triggered', validFiles);
                                                        setCulturalFiles(prev => {
                                                            const newFiles = validFiles.filter(
                                                                f => !prev.some(p => p.name === f.name && p.size === f.size)
                                                            );
                                                            return [...prev, ...newFiles];
                                                        });
                                                    }
                                                    // reset AFTER processing
                                                    e.target.value = '';
                                                }} multiple />
                                                <Button leftIcon={<FaPlus />} size="sm" variant="outline" colorScheme="pink" onClick={openCulturalFilePicker}>Add PDF Files</Button>
                                                {culturalFiles.length > 0 && (
                                                    <VStack align="stretch" spacing={2} w="full">
                                                        {culturalFiles.map((file, i) => (
                                                            <HStack key={i} p={2} bg="pink.50" borderRadius="lg" border="1px solid" borderColor="pink.100" justify="space-between">
                                                                <HStack spacing={2} overflow="hidden">
                                                                    <Icon as={FaFilePdf} color="red.400" flexShrink={0} />
                                                                    <Text fontSize="xs" fontWeight="medium" isTruncated>{file.name}</Text>
                                                                    <Text fontSize="2xs" color={mutedTextColor} flexShrink={0}>({(file.size / 1024).toFixed(0)} KB)</Text>
                                                                </HStack>
                                                                <Box as="button" onClick={() => setCulturalFiles(prev => prev.filter((_, idx) => idx !== i))} p={1} borderRadius="md" _hover={{ bg: 'red.100' }}>
                                                                    <Icon as={FaTimes} color="red.400" boxSize={3} />
                                                                </Box>
                                                            </HStack>
                                                        ))}
                                                    </VStack>
                                                )}
                                            </VStack>
                                        </HStack>
                                    </VStack>
                                </Section>
                            )}

                            {/* Verification Section */}
                            <Box p={{ base: 5, md: 8 }} borderRadius="2xl" bg={panelBg} borderWidth="1px" borderColor={boxBorderColor} boxShadow="sm">
                                <Text fontSize="xl" fontWeight="bold" mb={6} color={textColor}>Final Declaration</Text>
                                <Divider mb={6} />
                                <VStack align="start" spacing={4}>
                                    <Checkbox isChecked={formData.notOnProbation} onChange={(e) => setFormData({ ...formData, notOnProbation: e.target.checked })} colorScheme="blue">
                                        I am not currently on academic or disciplinary probation.
                                    </Checkbox>
                                    <Checkbox isChecked={formData.trueStatement} onChange={(e) => setFormData({ ...formData, trueStatement: e.target.checked })} colorScheme="blue">
                                        I confirm all documents provided are true and accurate.
                                    </Checkbox>
                                </VStack>
                                <Button mt={{ base: 6, md: 10 }} size="lg" colorScheme="green" fontWeight="black" w="full" h={{ base: '56px', md: '70px' }} fontSize={{ base: 'md', md: 'xl' }} isLoading={submitting} loadingText="Submitting..." onClick={handleSubmission}>
                                    SUBMIT {selectedRole.replace('_', ' ').toUpperCase()} APPLICATION
                                </Button>
                            </Box>
                        </VStack>
                        </Box> {/* end photo gate */}
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
                            {uploadingPhoto ? (
                                <VStack spacing={3} py={8}>
                                    <Spinner size="xl" color="blue.500" thickness="4px" />
                                    <Text fontWeight="bold" color="blue.600">Uploading photo to server...</Text>
                                    <Text fontSize="xs" color="gray.500">Please wait, do not close this window.</Text>
                                </VStack>
                            ) : (
                                <Box
                                    w="full" h="140px" p={6}
                                    border="2px dashed" borderColor="blue.300" borderRadius="xl"
                                    textAlign="center"
                                    _hover={{ borderColor: 'blue.500', bg: 'blue.50' }}
                                    cursor="pointer" position="relative" transition="0.2s"
                                >
                                    <Input
                                        type="file" opacity={0} position="absolute"
                                        w="full" h="full" top={0} left={0}
                                        cursor="pointer" accept="image/*"
                                        onChange={handlePhotoChange}
                                    />
                                    <Icon as={FaCamera} boxSize={10} color="blue.400" mb={2} />
                                    <Text fontWeight="bold" fontSize="md">Click to Upload Photo</Text>
                                    <Text fontSize="xs" color="gray.500" mt={1}>JPG or PNG — Maximum 5MB</Text>
                                </Box>
                            )}
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
            p={{ base: 5, md: 8 }}
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
                <Text fontWeight="black" fontSize="xl" color={useColorModeValue('gray.800', 'white')}>{title}</Text>
                <Text fontSize="sm" color={useColorModeValue('gray.500', 'gray.400')}>{description}</Text>
            </VStack>
            {disabled && (
                <Badge position="absolute" top={4} right={4} colorScheme="green" variant="solid">Submitted</Badge>
            )}
        </VStack>
    );
};

const Section = ({ title, children }) => {
    const textColor = useColorModeValue('gray.700', 'whiteAlpha.900');
    const sectionBg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.100', 'gray.700');

    return (
        <Box>
            <Text fontSize="xl" fontWeight="black" mb={4} color={textColor} px={2}>{title}</Text>
            <Box p={{ base: 6, md: 8 }} borderRadius="2xl" bg={sectionBg} borderWidth="1px" borderColor={borderColor} boxShadow="sm">
                {children}
            </Box>
        </Box>
    );
};

export default ApplicationFormDashboard;
