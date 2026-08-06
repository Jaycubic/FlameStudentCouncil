// src/pages/StudentCouncilForm.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Box, VStack, HStack, Text, Checkbox, Button, Input, Textarea,
    FormControl, FormLabel, Image, Icon, useColorModeValue, useDisclosure,
    Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
    ModalBody, ModalFooter, useToast, SimpleGrid, Alert, AlertIcon,
    CircularProgress, List, ListItem, Menu, MenuButton, MenuList, MenuItem,
    Container, ScaleFade, Fade, Divider, Badge, FormHelperText, Spinner, Tooltip,
    Select
} from '@chakra-ui/react';
import { ChevronDownIcon, ArrowForwardIcon, CheckIcon as ChakraCheckIcon } from '@chakra-ui/icons';
import { FaMale, FaFemale, FaUser, FaCamera, FaChevronLeft, FaFilePdf, FaPlus, FaTimes, FaVoteYea, FaSave } from 'react-icons/fa';
import PageHeader from '../components/layout/PageHeader';
import { formSubmissionService } from '../services/formSubmissionService';
import { formProcessingService } from '../services/formProcessingService';
import { authService } from '../services/authService';
import { timeSettingsService } from '../services/timeSettingsService';
import flameLogo from '../assets/img/FLAME.png';
const defaultProfilePhoto = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const MotionBox = motion(Box);
const MotionVStack = motion(VStack);
const MotionHStack = motion(HStack);

const ALLOWED_SHEET_HOSTS = ['docs.google.com', 'flamestudentcouncil.in'];
const safeOpen = (url) => {
    try {
        const parsed = new URL(url);
        if (ALLOWED_SHEET_HOSTS.includes(parsed.hostname)) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    } catch {
        console.warn('Invalid URL blocked from opening:', url);
    }
};

// ─── Word counter helper ──────────────────────────────────────────────────────
function countWords(text) {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).length;
}

function StudentCouncilForm() {
    const navigate = useNavigate();
    const toast = useToast();
    const { isOpen: isPhotoModalOpen, onOpen: onPhotoModalOpen, onClose: onPhotoModalClose } = useDisclosure();

    const bgColor = useColorModeValue('white', 'gray.800');
    const panelBg = useColorModeValue('gray.50', 'gray.700');
    const boxBorderColor = useColorModeValue('blue.200', 'blue.500');
    const textColor = useColorModeValue('gray.800', 'white');
    const secondaryTextColor = useColorModeValue('gray.600', 'gray.300');
    const mutedTextColor = useColorModeValue('gray.500', 'gray.400');

    // State
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isApplicationOpen, setIsApplicationOpen] = useState(true);
    const [appStatusMessage, setAppStatusMessage] = useState('');
    const [agreedToInstructions, setAgreedToInstructions] = useState(false);
    const [submissionDone, setSubmissionDone] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [submittedPosition, setSubmittedPosition] = useState(null);
    const [timeSettings, setTimeSettings] = useState(null);
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    const [timerStatus, setTimerStatus] = useState('Checking...');

    // Positions from API
    const [positions, setPositions] = useState([]);

    // Form Data
    const [formData, setFormData] = useState({
        name: '', studentId: '', mobileNumber: '', email: '',
        gender: '', batch: '', photoUrl: defaultProfilePhoto,
        notOnProbation: false, trueStatement: false, readHandbook: false,
    });

    // Election-specific fields (autosaved)
    const [positionSelected, setPositionSelected] = useState('');
    const [communityService, setCommunityService] = useState('');
    const [statementOfPurpose, setStatementOfPurpose] = useState('');

    // File states
    const [photoFile, setPhotoFile] = useState(null);
    const [attachmentFiles, setAttachmentFiles] = useState([]);
    const [generatingSheet, setGeneratingSheet] = useState(false);
    const [sheetReady, setSheetReady] = useState(null);
    const attachmentFileRef = useRef(null);
    const pollingRef = useRef(null);
    const autosaveTimerRef = useRef(null);

    const MAX_SIZE = 5 * 1024 * 1024;
    const PHOTO_MAX_SIZE = 5 * 1024 * 1024;
    const WORD_LIMIT = 250;

    const [photoExists, setPhotoExists] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [studentCgpa, setStudentCgpa] = useState(null);
    const [draftSaving, setDraftSaving] = useState(false);

    // ── HTTP REST Autosave logic (Notion/GitHub style) ────────────────────────
    const saveDraftHTTP = useCallback(async (posVal, csVal, sopVal) => {
        if (!posVal && !csVal && !sopVal) return;
        setDraftSaving(true);
        try {
            await fetch('/api/election-draft', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-id': localStorage.getItem('deviceId') || '',
                },
                credentials: 'include',
                body: JSON.stringify({
                    position_selected: posVal,
                    community_service: csVal,
                    statement_of_purpose: sopVal,
                }),
            });
        } catch (err) {
            console.warn('[HTTP Autosave] Draft save failed:', err.message);
        } finally {
            setDraftSaving(false);
        }
    }, []);

    // Debounced autosave on input change
    const triggerAutosave = useCallback((posVal, csVal, sopVal) => {
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = setTimeout(() => {
            saveDraftHTTP(posVal, csVal, sopVal);
        }, 800); // 800ms debounce after typing stops
    }, [saveDraftHTTP]);

    // ── Fetch prefill and status ──────────────────────────────────────────────
    const fetchStatusAndPrefill = async () => {
        let loadedSettings = null;

        try {
            const timeRes = await timeSettingsService.getSettings();
            loadedSettings = timeRes?.data ?? timeRes;
            if (loadedSettings?.start_date) {
                setTimeSettings(loadedSettings);
            } else {
                loadedSettings = null;
            }
        } catch (timeErr) {
            console.warn('[CouncilForm] Time settings unavailable (non-fatal):', timeErr.message);
        }

        try {
            const prefillData = await formProcessingService.getPrefillData();
            const p = prefillData.prefill;
            const photoName = p.photo || p.student_id;

            setFormData(prev => ({
                ...prev,
                name: p.name || prev.name,
                studentId: p.student_id || prev.studentId,
                mobileNumber: p.mobile_number || prev.mobileNumber,
                email: p.email || prev.email,
                gender: p.gender || prev.gender,
                batch: p.batch || prev.batch,
                photoUrl: prefillData.photoExists && photoName
                    ? `/api/photos/${photoName}?t=${Date.now()}`
                    : defaultProfilePhoto,
            }));
            setPhotoExists(prefillData.photoExists);
            setHasSubmitted(prefillData.hasSubmitted);
            setSubmittedPosition(prefillData.submittedPosition || null);

            const rawCgpa = p.cgpa;
            setStudentCgpa(rawCgpa != null ? parseFloat(rawCgpa) : null);

            // Load positions
            if (prefillData.positions) {
                setPositions(prefillData.positions);
            }

            // Restore draft
            if (prefillData.draft) {
                const d = prefillData.draft;
                if (d.position_selected) setPositionSelected(d.position_selected);
                if (d.community_service) setCommunityService(d.community_service);
                if (d.statement_of_purpose) setStatementOfPurpose(d.statement_of_purpose);
            }

            // Restore agreed from localStorage
            const savedAgreed = localStorage.getItem('councilForm_agreed');
            if (savedAgreed === 'true') setAgreedToInstructions(true);

            // Application window
            if (loadedSettings?.start_date) {
                const now = new Date();
                const startDate = new Date(`${loadedSettings.start_date}T${loadedSettings.start_time}`);
                const endDate = new Date(`${loadedSettings.end_date}T${loadedSettings.end_time}`);

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
            console.error('[CouncilForm] Prefill error:', err);
            toast({
                title: 'System Error',
                description: 'Failed to load your application data. Please refresh.',
                status: 'error',
                duration: 5000,
            });
        }
    };

    // Timer
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
        calculateTimeLeft();
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

    // ── Photo handler ─────────────────────────────────────────────────────────
    const handlePhotoChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
            toast({ title: 'Invalid File Type', description: 'Only JPG, PNG, or WebP images are accepted.', status: 'error', duration: 5000 });
            return;
        }
        if (file.size > PHOTO_MAX_SIZE) {
            toast({ title: 'Photo Too Large', description: 'Maximum allowed photo size is 5MB.', status: 'error', duration: 6000 });
            return;
        }
        const blobUrl = URL.createObjectURL(file);
        setPhotoFile(file);
        setFormData(prev => ({ ...prev, photoUrl: blobUrl }));
        setUploadingPhoto(true);
        try {
            const uploadResult = await formProcessingService.uploadPhoto(file, formData.studentId || formData.student_id);
            setPhotoExists(true);
            const exactFilename = uploadResult?.filename;
            const photoUrl = exactFilename
                ? `/api/photos/${exactFilename}?t=${Date.now()}`
                : `/api/photos/${formData.studentId || formData.student_id}?t=${Date.now()}`;
            setFormData(prev => ({ ...prev, photoUrl }));
            toast({ title: '✅ Photo Uploaded', description: 'Your profile photo has been saved.', status: 'success', duration: 4000 });
            onPhotoModalClose();
        } catch (err) {
            setPhotoFile(null);
            setFormData(prev => ({ ...prev, photoUrl: defaultProfilePhoto }));
            toast({ title: 'Upload Failed', description: err.message, status: 'error', duration: 5000 });
        } finally {
            setUploadingPhoto(false);
        }
    };

    // ── Sheet generation (single workbook) ────────────────────────────────────
    const handleGenerateSheet = async () => {
        setGeneratingSheet(true);
        try {
            const deviceId = localStorage.getItem('deviceId') || '';
            const response = await fetch('/api/sheets/workbook', {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'x-device-id': deviceId }
            });
            const result = await response.json();
            if (result.success && result.url) {
                setSheetReady(result.url);
                toast({ title: 'Ready!', description: 'Your Workbook is ready. Click the button to open it.', status: 'success' });
                return;
            }
            if (response.status === 202 && result.jobId) {
                toast({ title: 'Processing', description: 'Server is busy — your workbook is queued. Please wait...', status: 'info', duration: 5000 });
                const sheetUrl = await pollJobStatus(result.jobId);
                setSheetReady(sheetUrl);
                toast({ title: 'Ready!', description: 'Your Workbook is ready. Click the button to open it.', status: 'success' });
                return;
            }
            throw new Error(result.message || 'Failed to generate workbook');
        } catch (error) {
            console.error('Sheet generation error:', error);
            toast({ title: 'Error', description: error.message, status: 'error' });
        } finally {
            setGeneratingSheet(false);
        }
    };

    const pollJobStatus = (jobId) => {
        return new Promise((resolve, reject) => {
            const deviceId = localStorage.getItem('deviceId') || '';
            let attempts = 0;
            const maxAttempts = 40;
            pollingRef.current = setInterval(async () => {
                attempts++;
                try {
                    const res = await fetch(`/api/sheets/job/${encodeURIComponent(jobId)}`, {
                        credentials: 'include',
                        headers: { 'x-device-id': deviceId }
                    });
                    const data = await res.json();
                    if (data.status === 'completed' && data.url) {
                        clearInterval(pollingRef.current);
                        resolve(data.url);
                    } else if (data.status === 'failed') {
                        clearInterval(pollingRef.current);
                        reject(new Error(data.error || 'Workbook generation failed'));
                    } else if (attempts >= maxAttempts) {
                        clearInterval(pollingRef.current);
                        reject(new Error('Workbook generation timed out. Please try again.'));
                    }
                } catch (err) {
                    clearInterval(pollingRef.current);
                    reject(err);
                }
            }, 3000);
        });
    };

    // ── Save Draft ────────────────────────────────────────────────────────────
    const handleSaveDraft = async () => {
        setDraftSaving(true);
        try {
            const response = await fetch('/api/election-draft', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-id': localStorage.getItem('deviceId') || '',
                },
                credentials: 'include',
                body: JSON.stringify({
                    position_selected: positionSelected,
                    community_service: communityService,
                    statement_of_purpose: statementOfPurpose,
                }),
            });
            const data = await response.json();
            if (data.success) {
                toast({
                    title: 'Draft Saved Successfully',
                    description: 'Your position choice, SOP, and Community Service notes have been saved.',
                    status: 'success',
                    duration: 3500,
                    isClosable: true,
                });
            } else {
                throw new Error(data.message || 'Failed to save draft');
            }
        } catch (err) {
            toast({
                title: 'Draft Save Failed',
                description: err.message,
                status: 'error',
                duration: 4000,
            });
        } finally {
            setDraftSaving(false);
        }
    };

    // ── Submission ────────────────────────────────────────────────────────────
    const handleSubmission = async () => {
        if (!photoExists && !photoFile) {
            toast({ title: 'Photo Required', description: 'Please upload a profile photo before submitting.', status: 'warning' });
            return;
        }
        if (!positionSelected) {
            toast({ title: 'Position Required', description: 'Please select a council position.', status: 'warning' });
            return;
        }
        if (!formData.readHandbook) {
            toast({ title: 'Required', description: 'Please confirm that you have read the Student Handbook.', status: 'warning' });
            return;
        }
        if (!formData.trueStatement) {
            toast({ title: 'Required', description: 'Please confirm that the information provided is accurate.', status: 'warning' });
            return;
        }

        const data = new FormData();
        data.append('position_selected', positionSelected);
        data.append('community_service', communityService);
        data.append('statement_of_purpose', statementOfPurpose);
        data.append('read_handbook', formData.readHandbook);
        Object.keys(formData).forEach(key => {
            if (key !== 'photoUrl' && key !== 'readHandbook') data.append(key, formData[key]);
        });
        if (photoFile) data.append('photo', photoFile);
        attachmentFiles.forEach(file => data.append('attachment', file));

        setSubmitting(true);
        try {
            await formSubmissionService.submit(data);
            setSubmissionDone(true);
            toast({
                title: 'Success',
                description: 'Your election application has been submitted successfully!',
                status: 'success',
                duration: 5000,
                isClosable: true
            });
            await fetchStatusAndPrefill();
        } catch (err) {
            const isConnectionError = err.message.includes('server is temporarily busy') ||
                err.message.includes('Network issue') ||
                err.message.includes('Server error');
            toast({
                title: isConnectionError ? 'Connection Issue' : 'Submission Error',
                description: isConnectionError
                    ? `${err.message} Your data is still in this form. Please wait a moment and try again.`
                    : err.message,
                status: isConnectionError ? 'warning' : 'error',
                duration: isConnectionError ? 12000 : 7000,
                isClosable: true
            });
        } finally {
            setSubmitting(false);
        }
    };

    // ── Early returns ─────────────────────────────────────────────────────────

    if (loading && !formData.name) return (
        <Container centerContent py={20} bg={bgColor} minH="100vh">
            <VStack spacing={4}>
                <CircularProgress isIndeterminate color="blue.500" size="60px" />
                <Text fontSize="lg" fontWeight="medium">Preparing your application...</Text>
            </VStack>
        </Container>
    );

    if (hasSubmitted) return (
        <Container centerContent py={20} bg={bgColor} minH="100vh">
            <MotionBox initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 20 }}>
                <VStack spacing={10} p={{ base: 8, md: 16 }} bgGradient="linear(to-br, green.500, green.700)" color="white" borderRadius="3xl" textAlign="center" boxShadow="2xl" maxW="xl">
                    <Box bg="whiteAlpha.200" p={6} borderRadius="full">
                        <Icon as={ChakraCheckIcon} boxSize={20} />
                    </Box>
                    <VStack spacing={4}>
                        <Text fontSize={{ base: "3xl", md: "5xl" }} fontWeight="black">Application Submitted!</Text>
                        <Text fontSize="xl" opacity={0.9} lineHeight="tall">You have successfully submitted your election application for <b>{submittedPosition || 'Student Council'}</b>. You can only apply for ONE position.</Text>
                    </VStack>
                    <Divider borderColor="whiteAlpha.300" />
                    <VStack w="full" spacing={6}>
                        <Button size="lg" variant="solid" colorScheme="whiteAlpha" bg="white" color="green.700" _hover={{ bg: 'gray.100' }} w="full" h="70px" fontSize="xl" fontWeight="bold" onClick={() => { authService.logout(); navigate('/login'); }}>LOGOUT</Button>
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
                        <Text fontSize="lg" lineHeight="tall">Your election application for <b>{positionSelected}</b> has been received. Our committee will review your submission.</Text>
                    </VStack>
                    <Divider borderColor="whiteAlpha.300" />
                    <VStack w="full" spacing={3}>
                        <Button size="lg" variant="outline" color="white" _hover={{ bg: 'whiteAlpha.200' }} w="full" onClick={() => { authService.logout(); navigate('/login'); }}>Logout</Button>
                    </VStack>
                </VStack>
            </MotionBox>
        </Container>
    );

    const sopWordCount = countWords(statementOfPurpose);
    const csWordCount = countWords(communityService);

    return (
        <Box p={{ base: 3, md: 8 }} bg={bgColor} minH="100vh" position="relative">
            {/* Timer */}
            <Box
                position={{ base: 'static', md: 'absolute' }}
                top={{ md: 6 }} right={{ md: 8 }} zIndex={10}
                mb={{ base: 2, md: 0 }}
                display="flex" justifyContent={{ base: 'center', md: 'flex-end' }}
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
                    {draftSaving && (
                        <Badge colorScheme="green" variant="subtle" fontSize="2xs">Saving...</Badge>
                    )}
                </HStack>
            </Box>

            <PageHeader title={timeSettings?.title || "Student Council Elections"} description="FLAME University Student Council" />

            <AnimatePresence mode="wait">
                {!agreedToInstructions ? (
                    <MotionVStack key="instructions" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} spacing={8} align="stretch" mt={6}>
                        <Box p={{ base: 6, md: 10 }} borderRadius="2xl" bg={panelBg} borderWidth="1px" borderColor={boxBorderColor} boxShadow="sm">
                            <Text fontSize={{ base: 'lg', md: '2xl' }} fontWeight="black" mb={{ base: 6, md: 8 }} color="red.500" textTransform="uppercase" letterSpacing="wider">
                                Important Instructions
                            </Text>
                            <List spacing={6}>
                                <ListItem display="flex" alignItems="start">
                                    <Icon as={ChakraCheckIcon} color="green.500" mt={1} mr={3} />
                                    <Text fontSize="md">
                                        <Text as="span" fontWeight="bold" color={textColor}>1. Photo:</Text> Upload a <b>passport photo</b> only if the photo section is <b>empty</b>. Otherwise, you cannot continue.
                                    </Text>
                                </ListItem>
                                <ListItem display="flex" alignItems="start">
                                    <Icon as={ChakraCheckIcon} color="green.500" mt={1} mr={3} />
                                    <Text fontSize="md">
                                        <Text as="span" fontWeight="bold" color={textColor}>2. Attachments:</Text> Upload <b>PDF ONLY</b> for supporting documents (optional).
                                    </Text>
                                </ListItem>
                                <ListItem display="flex" alignItems="start">
                                    <Icon as={ChakraCheckIcon} color="green.500" mt={1} mr={3} />
                                    <Text fontSize="md">
                                        <Text as="span" fontWeight="bold" color={textColor}>3. Generate Workbook:</Text> On clicking the <b>Generate Workbook</b> button, wait <b>5–10 seconds</b> for processing. If generation fails, <b>retry</b>.
                                    </Text>
                                </ListItem>
                                <ListItem display="flex" alignItems="start">
                                    <Icon as={ChakraCheckIcon} color="green.500" mt={1} mr={3} />
                                    <Text fontSize="md">
                                        <Text as="span" fontWeight="bold" color={textColor}>4. Allow Access:</Text> When the workbook opens, click <b>Allow Access</b> at the top of the Google Sheet. This is <b>required</b> for your photo to load correctly.
                                    </Text>
                                </ListItem>
                                <ListItem display="flex" alignItems="start">
                                    <Icon as={ChakraCheckIcon} color="green.500" mt={1} mr={3} />
                                    <Text fontSize="md">
                                        <Text as="span" fontWeight="bold" color={textColor}>5. After Submission:</Text> Once you submit your election form, <b>access to the Google Sheet will be removed automatically</b>.
                                    </Text>
                                </ListItem>
                            </List>
                            <Divider my={8} />
                            <Checkbox isChecked={agreedToInstructions} onChange={(e) => { setAgreedToInstructions(e.target.checked); localStorage.setItem('councilForm_agreed', e.target.checked); }} colorScheme="blue" size="lg">
                                <Text fontSize="md" fontWeight="medium">I have read and understood the instructions and agree to provide accurate information.</Text>
                            </Checkbox>
                        </Box>
                        <Button h={{ base: '50px', md: '60px' }} fontSize={{ base: 'md', md: 'lg' }} colorScheme="blue" isDisabled={!agreedToInstructions} onClick={() => { setAgreedToInstructions(true); localStorage.setItem('councilForm_agreed', 'true'); }} rightIcon={<ArrowForwardIcon />}>Proceed to Application</Button>
                    </MotionVStack>
                ) : (
                    <MotionVStack key="form-content" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} spacing={{ base: 5, md: 10 }} mt={{ base: 4, md: 8 }} align="stretch">

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
                                        <Text>{formData.gender || 'Gender'} | {formData.studentId || 'ID'} | {formData.batch || 'Batch'}</Text>
                                    </HStack>
                                    <Text color={mutedTextColor} fontSize={{ base: 'xs', md: 'md' }}>{formData.email} • {formData.mobileNumber}</Text>
                                    {studentCgpa !== null && (
                                        <Badge colorScheme="purple" fontSize={{ base: 'xs', md: 'sm' }} px={3} py={1} borderRadius="md">
                                            CGPA: {studentCgpa.toFixed(2)}
                                        </Badge>
                                    )}
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
                            {!photoExists && (
                                <Box
                                    position="absolute" top={0} left={0} right={0} bottom={0}
                                    zIndex={10} borderRadius="2xl" bg="blackAlpha.100" backdropFilter="blur(2px)" cursor="not-allowed"
                                    onClick={() => {
                                        toast({
                                            title: '📸 Upload Photo First',
                                            description: 'A profile photo is mandatory before you can fill this section.',
                                            status: 'warning', duration: 4000, isClosable: true,
                                        });
                                        onPhotoModalOpen();
                                    }}
                                />
                            )}

                            <VStack spacing={10} align="stretch" opacity={photoExists ? 1 : 0.45} pointerEvents={photoExists ? 'auto' : 'none'}>

                                {/* ── Position Selection ── */}
                                <Section title="Council Position">
                                    <FormControl isRequired>
                                        <FormLabel fontWeight="bold" fontSize="sm">
                                            Please select which position you are interested in? (You can apply for ONE position ONLY)
                                        </FormLabel>
                                        <Select
                                            placeholder="-- Select a Position --"
                                            value={positionSelected}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setPositionSelected(val);
                                                triggerAutosave(val, communityService, statementOfPurpose);
                                            }}
                                            onBlur={() => saveDraftHTTP(positionSelected, communityService, statementOfPurpose)}
                                            size="lg"
                                            borderRadius="xl"
                                            bg={useColorModeValue('white', 'gray.700')}
                                        >
                                            {positions.map((p) => (
                                                <option key={p.id} value={p.description}>{p.description}</option>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Section>

                                {/* ── Community Service ── */}
                                <Section title="Community Service">
                                    <FormControl>
                                        <FormLabel fontWeight="bold" fontSize="sm">
                                            Describe your community service involvement and contributions
                                        </FormLabel>
                                        <Textarea
                                            value={communityService}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setCommunityService(val);
                                                triggerAutosave(positionSelected, val, statementOfPurpose);
                                            }}
                                            onBlur={() => saveDraftHTTP(positionSelected, communityService, statementOfPurpose)}
                                            placeholder="Describe your community service activities, volunteer work, and social contributions..."
                                            minH="200px"
                                            resize="vertical"
                                            borderRadius="xl"
                                            bg={useColorModeValue('white', 'gray.700')}
                                        />
                                        <HStack justify="space-between" mt={2}>
                                            <FormHelperText color={csWordCount > WORD_LIMIT ? 'red.500' : mutedTextColor} fontWeight={csWordCount > WORD_LIMIT ? 'bold' : 'normal'}>
                                                {csWordCount} / {WORD_LIMIT} words {csWordCount > WORD_LIMIT && '(over limit)'}
                                            </FormHelperText>
                                            {draftSaving && <Text fontSize="2xs" color="green.500">Auto-saving...</Text>}
                                        </HStack>
                                    </FormControl>
                                </Section>

                                {/* ── Statement of Purpose ── */}
                                <Section title="Statement of Purpose">
                                    <FormControl>
                                        <FormLabel fontWeight="bold" fontSize="sm">
                                            Write your statement of purpose for this council position
                                        </FormLabel>
                                        <Textarea
                                            value={statementOfPurpose}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setStatementOfPurpose(val);
                                                triggerAutosave(positionSelected, communityService, val);
                                            }}
                                            onBlur={() => saveDraftHTTP(positionSelected, communityService, statementOfPurpose)}
                                            placeholder="Explain why you are the best candidate for this position, your vision, goals, and how you plan to serve the student body..."
                                            minH="200px"
                                            resize="vertical"
                                            borderRadius="xl"
                                            bg={useColorModeValue('white', 'gray.700')}
                                        />
                                        <HStack justify="space-between" mt={2}>
                                            <FormHelperText color={sopWordCount > WORD_LIMIT ? 'red.500' : mutedTextColor} fontWeight={sopWordCount > WORD_LIMIT ? 'bold' : 'normal'}>
                                                {sopWordCount} / {WORD_LIMIT} words {sopWordCount > WORD_LIMIT && '(over limit)'}
                                            </FormHelperText>
                                            {draftSaving && <Text fontSize="2xs" color="green.500">Auto-saving...</Text>}
                                        </HStack>
                                    </FormControl>
                                </Section>

                                {/* ── Workbook Section ── */}
                                <Section title="Student Council Workbook">
                                    <VStack spacing={0} align="stretch">
                                        <HStack spacing={4} align="start">
                                            <VStack spacing={0} align="center" minW="32px">
                                                <Box w="32px" h="32px" borderRadius="full" bg="blue.500" color="white" display="flex" alignItems="center" justifyContent="center" fontWeight="bold" fontSize="sm">1</Box>
                                                <Box w="2px" h="40px" bg="blue.200" />
                                            </VStack>
                                            <VStack align="start" spacing={2} pb={4} flex="1">
                                                <Text fontWeight="bold" fontSize="sm">Open your Student Council Workbook</Text>
                                                <Text fontSize="xs" color={mutedTextColor}>Fill in your achievements in the standardized spreadsheet.</Text>
                                                {generatingSheet ? (
                                                    <HStack spacing={3} p={3} bg="blue.50" borderRadius="lg" w="full">
                                                        <CircularProgress isIndeterminate size="24px" color="blue.500" />
                                                        <VStack align="start" spacing={0}>
                                                            <Text fontSize="xs" fontWeight="bold" color="blue.700">Preparing your Workbook...</Text>
                                                            <Text fontSize="2xs" color="blue.500">This may take a few seconds</Text>
                                                        </VStack>
                                                    </HStack>
                                                ) : sheetReady ? (
                                                    <Button leftIcon={<Icon as={FaVoteYea} />} colorScheme="green" variant="solid" size="sm" onClick={() => safeOpen(sheetReady)}>
                                                        Open Student Council Workbook
                                                    </Button>
                                                ) : (
                                                    <Button leftIcon={<Icon as={FaVoteYea} />} colorScheme="blue" variant="solid" size="sm" onClick={handleGenerateSheet}>
                                                        Generate Student Council Workbook
                                                    </Button>
                                                )}
                                            </VStack>
                                        </HStack>
                                        <HStack spacing={4} align="start">
                                            <VStack spacing={0} align="center" minW="32px">
                                                <Box w="32px" h="32px" borderRadius="full" bg="blue.500" color="white" display="flex" alignItems="center" justifyContent="center" fontWeight="bold" fontSize="sm">2</Box>
                                            </VStack>
                                            <VStack align="start" spacing={3} flex="1">
                                                <Text fontWeight="bold" fontSize="sm">Upload Supporting Documents (PDF) — Optional</Text>
                                                <input ref={attachmentFileRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={(e) => {
                                                    const files = Array.from(e.target.files || []);
                                                    if (files.length === 0) return;
                                                    const validFiles = files.filter(file => {
                                                        if (file.type !== 'application/pdf') {
                                                            toast({ title: 'Invalid File', description: `${file.name} is not a PDF.`, status: 'error' });
                                                            return false;
                                                        }
                                                        if (file.size > MAX_SIZE) {
                                                            toast({ title: 'File too large', description: `${file.name} exceeds 5MB limit`, status: 'error' });
                                                            return false;
                                                        }
                                                        return true;
                                                    });
                                                    if (validFiles.length > 0) {
                                                        setAttachmentFiles(prev => {
                                                            const newFiles = validFiles.filter(f => !prev.some(p => p.name === f.name && p.size === f.size));
                                                            return [...prev, ...newFiles];
                                                        });
                                                    }
                                                    e.target.value = '';
                                                }} multiple />
                                                <Button leftIcon={<FaPlus />} size="sm" variant="outline" colorScheme="blue" onClick={() => { if (attachmentFileRef.current) { attachmentFileRef.current.value = ''; attachmentFileRef.current.click(); } }}>Add PDF Files</Button>
                                                {attachmentFiles.length > 0 && (
                                                    <VStack align="stretch" spacing={2} w="full">
                                                        {attachmentFiles.map((file, i) => (
                                                            <HStack key={i} p={2} bg="blue.50" borderRadius="lg" border="1px solid" borderColor="blue.100" justify="space-between">
                                                                <HStack spacing={2} overflow="hidden">
                                                                    <Icon as={FaFilePdf} color="red.400" flexShrink={0} />
                                                                    <Text fontSize="xs" fontWeight="medium" isTruncated>{file.name}</Text>
                                                                    <Text fontSize="2xs" color={mutedTextColor} flexShrink={0}>({(file.size / 1024).toFixed(0)} KB)</Text>
                                                                </HStack>
                                                                <Box as="button" onClick={() => setAttachmentFiles(prev => prev.filter((_, idx) => idx !== i))} p={1} borderRadius="md" _hover={{ bg: 'red.100' }}>
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

                                {/* Final Declaration */}
                                <Box p={{ base: 5, md: 8 }} borderRadius="2xl" bg={panelBg} borderWidth="1px" borderColor={boxBorderColor} boxShadow="sm">
                                    <Text fontSize="xl" fontWeight="bold" mb={6} color={textColor}>Final Declaration</Text>
                                    <Divider mb={6} />
                                    <VStack align="start" spacing={4}>
                                        <Checkbox isChecked={formData.readHandbook} onChange={(e) => setFormData({ ...formData, readHandbook: e.target.checked })} colorScheme="blue">
                                            I have read the Student Handbook and the Students' Council Manual and I am aware of the rules and regulations governing the Students' Council elections.
                                        </Checkbox>
                                        <Checkbox isChecked={formData.notOnProbation} onChange={(e) => setFormData({ ...formData, notOnProbation: e.target.checked })} colorScheme="blue">
                                            I am not currently on academic or disciplinary probation.
                                        </Checkbox>
                                        <Checkbox isChecked={formData.trueStatement} onChange={(e) => setFormData({ ...formData, trueStatement: e.target.checked })} colorScheme="blue">
                                            I state that the above is true and I have not provided any false information.
                                        </Checkbox>
                                    </VStack>
                                    <HStack spacing={4} mt={{ base: 6, md: 10 }}>
                                         <Button
                                             size="lg"
                                             variant="outline"
                                             colorScheme="blue"
                                             fontWeight="bold"
                                             flex="1"
                                             h={{ base: '56px', md: '70px' }}
                                             fontSize={{ base: 'sm', md: 'lg' }}
                                             isLoading={draftSaving}
                                             loadingText="Saving..."
                                             onClick={handleSaveDraft}
                                             leftIcon={<FaSave />}
                                             borderRadius="xl"
                                         >
                                             SAVE AS DRAFT
                                         </Button>
                                         <Button
                                             size="lg"
                                             colorScheme="green"
                                             fontWeight="black"
                                             flex="2"
                                             h={{ base: '56px', md: '70px' }}
                                             fontSize={{ base: 'md', md: 'xl' }}
                                             isLoading={submitting}
                                             loadingText="Submitting..."
                                             onClick={handleSubmission}
                                             borderRadius="xl"
                                         >
                                             SUBMIT ELECTION APPLICATION
                                         </Button>
                                     </HStack>
                                </Box>
                            </VStack>
                        </Box>
                    </MotionVStack>
                )}
            </AnimatePresence>

            {/* Photo Modal */}
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
                                        cursor="pointer" accept="image/jpeg,image/png,image/webp"
                                        onChange={handlePhotoChange}
                                    />
                                    <Icon as={FaCamera} boxSize={10} color="blue.400" mb={2} />
                                    <Text fontWeight="bold" fontSize="md">Click to Upload Photo</Text>
                                    <Text fontSize="xs" color="gray.500" mt={1}>JPG, PNG or WebP — Maximum 5MB</Text>
                                </Box>
                            )}
                        </VStack>
                    </ModalBody>
                </ModalContent>
            </Modal>
        </Box>
    );
}

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

export default StudentCouncilForm;
