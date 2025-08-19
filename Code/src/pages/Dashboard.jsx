// src/pages/Dashboard.jsx
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  VStack,
  HStack,
  Text,
  Checkbox,
  Button,
  Input,
  Textarea,
  FormControl,
  FormLabel,
  Image,
  Icon,
  useColorModeValue,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  useToast,
  SimpleGrid,
  CardBody,
  Alert,
  AlertIcon,
  CircularProgress,
  List,
  ListItem,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from '@chakra-ui/react';
import {
  ChevronDownIcon,
  ArrowForwardIcon,
  CheckIcon as ChakraCheckIcon,
} from '@chakra-ui/icons';
import { FaMale, FaFemale, FaUser } from 'react-icons/fa';
import PageHeader from '../components/layout/PageHeader';
import { formSubmissionService } from '../services/formSubmissionService';
import { authService } from '../services/authService';
import { positionService } from '../services/positionService';
import { photoService } from '../services/photoService';

// Import logo
import flameLogo from '../assets/img/FLAME.png';

// Placeholder for profile photo if none
const defaultProfilePhoto = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

// Motion-wrapped Chakra components
const MotionBox = motion(Box);
const MotionButton = motion(Button);

// Use a tweened height animation for smooth static expansion (no spring jitter while scrolling)
const heightTransition = { duration: 0.28, ease: 'easeInOut' };

function ApplicationFormDashboard() {
  const toast = useToast();
  const { isOpen: isSportModalOpen, onOpen: onSportModalOpen, onClose: onSportModalClose } = useDisclosure();
  const { isOpen: isCulturalModalOpen, onOpen: onCulturalModalOpen, onClose: onCulturalModalClose } = useDisclosure();
  const { isOpen: isPhotoModalOpen, onOpen: onPhotoModalOpen, onClose: onPhotoModalClose } = useDisclosure();

  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'white');

  // Border / input colors
  const boxBorderColor = useColorModeValue('blue.300', 'pink.500');
  const inputBorderColor = useColorModeValue('blue.400', 'pink.500');
  const inputHoverBorderColor = useColorModeValue('blue.500', 'pink.600');

  const hoverGradient = useColorModeValue(
    'linear-gradient(90deg,#60a5fa,#93c5fd)',
    'linear-gradient(90deg,#9f7aea,#f472b6)'
  );
  const activeGradient = useColorModeValue(
    'linear-gradient(90deg,#3b82f6,#60a5fa)',
    'linear-gradient(90deg,#7c3aed,#ec4899)'
  );

  const primaryLightColor = 'blue.500';
  const primaryLightHover = 'blue.600';

  // User / form state
  const [user, setUser] = useState(null);
  const [agreedToInstructions, setAgreedToInstructions] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isApplicationOpen, setIsApplicationOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  const [position, setPosition] = useState('');
  const [cgpa, setCgpa] = useState('');
  const [sportsScore, setSportsScore] = useState('');
  const [culturalScore, setCulturalScore] = useState('');
  const [communityService, setCommunityService] = useState('');
  const [statementOfPurpose, setStatementOfPurpose] = useState('');
  const [notOnProbation, setNotOnProbation] = useState(false);
  const [readHandbook, setReadHandbook] = useState(false);
  const [trueStatement, setTrueStatement] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [sportFiles, setSportFiles] = useState([]);
  const [culturalFiles, setCulturalFiles] = useState([]);
  const [academicFiles, setAcademicFiles] = useState([]);
  const [otherFiles, setOtherFiles] = useState([]);

  const [positions, setPositions] = useState([]);

  // Expansion control:
  // - requested: toggled by header click (persistent)
  // - focus: set while textarea has focus (temporary but persistent while focused)
  const [communityRequestedExpanded, setCommunityRequestedExpanded] = useState(false);
  const [communityFocusExpanded, setCommunityFocusExpanded] = useState(false);

  const [sopRequestedExpanded, setSopRequestedExpanded] = useState(false);
  const [sopFocusExpanded, setSopFocusExpanded] = useState(false);

  // Final expansion combines both (so focus keeps it open)
  const communityExpanded = communityRequestedExpanded || communityFocusExpanded;
  const sopExpanded = sopRequestedExpanded || sopFocusExpanded;

  const communityRef = useRef(null);
  const sopRef = useRef(null);

  // Heights (tweakable)
  // Collapsed height (visible when idle)
  const collapsedHeight = 100; // px (user set)
  // Reduced expansion height (less huge)
  const communityMaxHeight = 320; // px when expanded
  const sopMaxHeight = 320; // px when expanded

  // Chakra `p={2}` equals 8px top + bottom = 16px
  const containerVerticalPadding = 16;
  const collapsedTextareaH = Math.max(40, collapsedHeight - containerVerticalPadding);
  const communityTextareaMaxH = Math.max(120, communityMaxHeight - containerVerticalPadding);
  const sopTextareaMaxH = Math.max(120, sopMaxHeight - containerVerticalPadding);

  const instructions = [
    'Statement of Purpose (SOP): Explain your motivation and goals for applying.',
    'Mandatory Upload: Upload files for the "Sport" and "Cultural" sections in PDF or JPG format.',
    'Optional Upload: Upload files for "Academic" and "Other" sections in various accepted formats if applicable.',
    'Confirmation: Check the boxes to confirm you are not on probation, have read the handbook, and that your information is accurate.',
    'The positions listed may vary depending on your academic program, so be sure to read through them carefully before selecting.',
    'Submission: Ensure all required sections are complete before submission.',
  ];

  const photoInstructions = [
    'Upload a formal passport-sized photo.',
    'File size must be less than 1MB.',
    'Accepted formats: JPEG, JPG, PNG.',
    'Photo should be recent, clear, and against a plain background.',
    'Ensure the photo is well-lit and shows your full face without accessories like hats or sunglasses.',
    'Professional attire is recommended.',
  ];

  useEffect(() => {
    async function loadUser() {
      setLoading(true);
      try {
        const currentUser = authService.getCurrentUser();
        setUser({
          name: currentUser?.studentName || '',
          studentId: currentUser?.studentCvueNo || '',
          mobileNumber: currentUser?.contactNo || '',
          email: currentUser?.email || '',
          batch: currentUser?.batch || '',
          gender: currentUser?.gender || '',
          photoUrl: currentUser?.photo ? `/photos/${currentUser.photo}.jpg` : defaultProfilePhoto,
        });
      } catch (err) {
        console.error('Failed to load user profile:', err);
        setUser({});
        toast({ title: 'Failed to load user details', status: 'warning', duration: 3000 });
      } finally {
        setLoading(false);
      }
    }

    async function loadPositions() {
      try {
        const response = await positionService.getAll();
        setPositions(response.data || []);
      } catch (err) {
        console.error('Failed to load positions:', err);
        toast({ title: 'Failed to load positions', status: 'error', duration: 3000 });
      }
    }

    loadUser();
    loadPositions();

    const storedAgreement = localStorage.getItem('agreedToInstructions');
    if (storedAgreement === 'true') {
      setAgreedToInstructions(true);
      setShowForm(true);
    }

    setIsApplicationOpen(true);
  }, [toast]);

  const handleAgreementChange = (e) => {
    const checked = e.target.checked;
    setAgreedToInstructions(checked);
    localStorage.setItem('agreedToInstructions', checked);
    if (checked) {
      setShowForm(true);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setPhotoFile(file);
      const localUrl = URL.createObjectURL(file);
      setUser((u) => ({ ...(u || {}), photoUrl: localUrl }));

      const resp = await photoService.uploadPhoto(file);
      const filename = resp?.filename || resp?.data?.filename || resp?.fileName;
      if (!filename) {
        toast({ title: 'Uploaded but backend did not return filename', status: 'warning' });
        return;
      }
      const proxied = photoService.getPhotoUrl(filename);
      setUser((u) => ({ ...(u || {}), photoUrl: proxied }));
      toast({ title: 'Photo uploaded', status: 'success', duration: 2500 });
    } catch (err) {
      console.error('Photo upload error:', err);
      toast({ title: 'Photo upload failed', status: 'error', duration: 4000 });
    }
  };

  const handleFileChange = (e, setter) => {
    setter(Array.from(e.target.files || []));
  };

  const calculateScore = (score) => {
    if (score === '' || score === null) return '';
    const num = Number(score);
    if (isNaN(num)) return '';
    let scaledScore;
    if (num <= 100) {
      scaledScore = num / 10;
    } else {
      const decayFactor = (num - 100) * 0.05;
      const adjustedMarks = 100 + decayFactor;
      scaledScore = adjustedMarks / 10;
    }
    return Math.round(scaledScore * 10) / 10;
  };

  const handleSportsScoreChange = (e) => {
    const value = e.target.value;
    setSportsScore(calculateScore(value));
  };

  const handleCulturalScoreChange = (e) => {
    const value = e.target.value;
    setCulturalScore(calculateScore(value));
  };

  const handleSubmit = async () => {
    if (!trueStatement || sportFiles.length === 0 || culturalFiles.length === 0) {
      toast({ title: 'Missing required fields', status: 'error', duration: 3000 });
      return;
    }

    setLoading(true);
    const formData = {
      name: user?.name || '',
      student_id: user?.studentId || '',
      mobile_number: user?.mobileNumber || '',
      email: user?.email || '',
      position,
      cgpa: parseFloat(cgpa),
      sports_score: sportsScore,
      cultural_score: culturalScore,
      community_service: communityService,
      statement_of_purpose: statementOfPurpose,
      not_on_probation: notOnProbation ? 1 : 0,
      read_handbook: readHandbook ? 1 : 0,
      tru_statement: trueStatement ? 1 : 0,
      Gender: user?.gender,
      Batch: user?.batch,
      Photo: photoFile ? photoFile.name : user?.photoUrl.split('/').pop().split('.jpg')[0],
    };

    try {
      await formSubmissionService.create(formData);
      toast({ title: 'Form submitted successfully', status: 'success', duration: 3000 });
    } catch (error) {
      toast({ title: 'Submission failed', status: 'error', duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const GenderIcon = () => {
    if (user?.gender === 'Male') {
      return <Icon as={FaMale} color="blue.500" boxSize={6} />;
    } else if (user?.gender === 'Female') {
      return <Icon as={FaFemale} color="pink.500" boxSize={6} />;
    }
    return <Icon as={FaUser} color="gray.500" boxSize={6} />;
  };

  if (loading) {
    return (
      <Box p={8} textAlign="center" bg={bgColor}>
        <CircularProgress isIndeterminate color="blue.500" />
        <Text mt={4}>Loading application...</Text>
      </Box>
    );
  }

  if (!isApplicationOpen) {
    return (
      <Box p={8} textAlign="center" bg={bgColor}>
        <Alert status="error">
          <AlertIcon />
          Application period has ended.
        </Alert>
      </Box>
    );
  }

  const borderBoxStyle = {
    bg: bgColor,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: boxBorderColor,
    borderRadius: 'lg',
  };

  const inputStyleProps = {
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: inputBorderColor,
    _hover: { borderColor: inputHoverBorderColor },
    transition: 'border-color 0.15s ease',
  };

  const primaryButtonLight = {
    bg: primaryLightColor,
    color: 'white',
    _hover: { bg: primaryLightHover },
  };
  const primaryButtonDark = {
    bgGradient: activeGradient,
    color: 'white',
    _hover: { bgGradient: hoverGradient },
  };

  const menuButtonStyle = {
    bg: 'white',
    color: 'gray.800',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: inputBorderColor,
    _hover: { bg: 'white' },
  };

  return (
    <Box p={{ base: 4, md: 8 }} bg={bgColor} color={textColor} borderRadius="xl">
      <PageHeader title="Candidate Application Form" description="Apply for student council positions" />

      {!showForm ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} style={{ background: 'transparent', overflow: 'hidden' }}>
          <MotionBox {...borderBoxStyle} mb={6} p={4} whileHover={{ scale: 1.01 }} transition={{ type: 'spring', stiffness: 200 }}>
            <CardBody p={0}>
              <Text fontSize="xl" fontWeight="bold" mb={3}>Instructions</Text>
              <List spacing={3}>
                {instructions.map((instr, idx) => (
                  <ListItem key={idx} display="flex" alignItems="center">
                    <Icon as={ChakraCheckIcon} color="green.500" mr={2} />
                    <Text>{instr}</Text>
                  </ListItem>
                ))}
              </List>
            </CardBody>
          </MotionBox>

          <Checkbox isChecked={agreedToInstructions} onChange={handleAgreementChange} colorScheme="blue">
            I have read and agree to the instructions and terms outlined above.
          </Checkbox>
        </motion.div>
      ) : (
        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }} style={{ background: 'transparent', overflow: 'hidden' }}>
          {/* Top Section */}
          <HStack justify="space-between" mb={8} p={4} alignItems="center" flexWrap={{ base: 'wrap', md: 'nowrap' }} {...borderBoxStyle}>
            <HStack spacing={4} flex="1" justify={{ base: 'center', md: 'flex-start' }} w="full">
              <Image
                src={photoFile ? URL.createObjectURL(photoFile) : user?.photoUrl || defaultProfilePhoto}
                alt="Profile Photo"
                borderRadius="full"
                boxSize={{ base: '80px', md: '100px' }}
                objectFit="cover"
                cursor={user?.photoUrl === defaultProfilePhoto ? 'pointer' : 'default'}
                onClick={user?.photoUrl === defaultProfilePhoto ? onPhotoModalOpen : undefined}
                transition="transform 0.2s"
                _hover={{ transform: 'scale(1.05)' }}
              />
              <VStack align="start" spacing={0}>
                <HStack>
                  <Text fontSize={{ base: 'xl', md: '2xl' }} fontWeight="bold">{user?.name || 'Name'}</Text>
                  <GenderIcon />
                </HStack>
                <Text fontSize={{ base: 'sm', md: 'md' }}>{user?.email || 'Email'}</Text>
                <Text fontSize={{ base: 'sm', md: 'md' }}>{user?.mobileNumber || 'Mobile Number'}</Text>
                <Text fontSize="sm" color="gray.500">Student ID: {user?.studentId || 'ID'}</Text>
                <Text fontSize="sm" color="gray.500">Batch: {user?.batch || 'Batch'}</Text>
              </VStack>
            </HStack>
            <Image src={flameLogo} alt="FLAME University Logo" boxSize={{ base: '80px', md: '120px' }} mt={{ base: 4, md: 0 }} alignSelf="center" />
          </HStack>

          {/* Form Fields */}
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            <FormControl>
              <FormLabel>Position Interested</FormLabel>
              <Menu>
                <MenuButton as={MotionButton} rightIcon={<ChevronDownIcon />} whileHover={{ scale: 1.02 }} {...menuButtonStyle}>
                  {position || 'Select a position'}
                </MenuButton>
                <MenuList maxH="200px" overflowY="auto">
                  {positions.map((pos) => (
                    <MenuItem key={pos.id} onClick={() => setPosition(pos.description)} _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}>
                      {pos.description}
                    </MenuItem>
                  ))}
                </MenuList>
              </Menu>
            </FormControl>

            <FormControl>
              <FormLabel>CGPA - Academics Score</FormLabel>
              <Input type="number" value={cgpa} onChange={(e) => setCgpa(e.target.value)} {...inputStyleProps} />
            </FormControl>
          </SimpleGrid>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mt={4}>
            <FormControl>
              <FormLabel>Sports Score</FormLabel>
              <MotionButton
                onClick={onSportModalOpen}
                leftIcon={<ArrowForwardIcon />}
                whileHover={{ x: 4 }}
                transition="0.2s"
                {...(useColorModeValue(primaryButtonLight, primaryButtonDark))}
              >
                Open Sport Sheet
              </MotionButton>
              <Input mt={2} type="number" placeholder="Enter raw score" onChange={handleSportsScoreChange} {...inputStyleProps} />
              <Text mt={1}>Calculated: {sportsScore || '—'}/10</Text>
            </FormControl>

            <FormControl>
              <FormLabel>Cultural Score</FormLabel>
              <MotionButton
                onClick={onCulturalModalOpen}
                leftIcon={<ArrowForwardIcon />}
                whileHover={{ x: 4 }}
                transition="0.2s"
                {...(useColorModeValue(primaryButtonLight, primaryButtonDark))}
              >
                Open Cultural Sheet
              </MotionButton>
              <Input mt={2} type="number" placeholder="Enter raw score" onChange={handleCulturalScoreChange} {...inputStyleProps} />
              <Text mt={1}>Calculated: {culturalScore || '—'}/10</Text>
            </FormControl>
          </SimpleGrid>

          {/* Community Service */}
          <Box mt={4}>
            <Box
              as="button"
              width="100%"
              textAlign="left"
              px={0}
              py={0}
              onClick={() => {
                // toggle persistent expansion only on click
                setCommunityRequestedExpanded((s) => !s);
                // if we're expanding by click, focus textarea for discoverability
                setTimeout(() => communityRef.current?.focus?.(), 0);
              }}
              aria-expanded={communityExpanded}
              style={{ cursor: 'pointer', background: 'transparent', border: 'none' }}
            >
              <FormLabel mb={2} cursor="pointer">Community Service</FormLabel>
            </Box>

            <motion.div
              layout
              initial={false}
              animate={{ maxHeight: communityExpanded ? communityMaxHeight : collapsedHeight }}
              transition={heightTransition}
              style={{ overflow: 'hidden', width: '100%' }}
            >
              <Box p={2} {...borderBoxStyle} display="block">
                <Textarea
                  ref={communityRef}
                  value={communityService}
                  onChange={(e) => setCommunityService(e.target.value)}
                  onFocus={() => setCommunityFocusExpanded(true)}
                  onBlur={() => setCommunityFocusExpanded(false)}
                  borderWidth="0"
                  boxShadow="none"
                  _focus={{ boxShadow: 'none', outline: 'none' }}
                  resize="vertical"
                  style={{
                    height: communityExpanded ? `${communityTextareaMaxH}px` : `${collapsedTextareaH}px`,
                    overflowY: 'auto',
                    transition: 'height 260ms ease-in-out',
                  }}
                />
              </Box>
            </motion.div>
          </Box>

          {/* Statement of Purpose */}
          <Box mt={4}>
            <Box
              as="button"
              width="100%"
              textAlign="left"
              px={0}
              py={0}
              onClick={() => {
                setSopRequestedExpanded((s) => !s);
                setTimeout(() => sopRef.current?.focus?.(), 0);
              }}
              aria-expanded={sopExpanded}
              style={{ cursor: 'pointer', background: 'transparent', border: 'none' }}
            >
              <FormLabel mb={2} cursor="pointer">Statement of Purpose</FormLabel>
            </Box>

            <motion.div
              layout
              initial={false}
              animate={{ maxHeight: sopExpanded ? sopMaxHeight : collapsedHeight }}
              transition={heightTransition}
              style={{ overflow: 'hidden', width: '100%' }}
            >
              <Box p={2} {...borderBoxStyle} display="block">
                <Textarea
                  ref={sopRef}
                  value={statementOfPurpose}
                  onChange={(e) => setStatementOfPurpose(e.target.value)}
                  onFocus={() => setSopFocusExpanded(true)}
                  onBlur={() => setSopFocusExpanded(false)}
                  borderWidth="0"
                  boxShadow="none"
                  _focus={{ boxShadow: 'none', outline: 'none' }}
                  resize="vertical"
                  style={{
                    height: sopExpanded ? `${sopTextareaMaxH}px` : `${collapsedTextareaH}px`,
                    overflowY: 'auto',
                    transition: 'height 260ms ease-in-out',
                  }}
                />
              </Box>
            </motion.div>
          </Box>

          {/* Uploads */}
          <Box mt={6} p={4} {...borderBoxStyle}>
            <Text fontWeight="semibold" mb={2}>Uploads</Text>
            <Alert status="warning" mb={4} variant="subtle" bg="transparent" color={useColorModeValue('orange.700', 'yellow.200')}>
              <AlertIcon color="yellow.300" />
              Mandatory: Sport and Cultural (PDF/JPG)
            </Alert>

            <FormControl>
              <FormLabel>Photo</FormLabel>
              <Input type="file" accept="image/*" onChange={handlePhotoChange} />
            </FormControl>

            <FormControl mt={4}>
              <FormLabel>Sport Files (Mandatory)</FormLabel>
              <Input type="file" multiple accept=".pdf,.jpg" onChange={(e) => handleFileChange(e, setSportFiles)} />
            </FormControl>

            <FormControl mt={4}>
              <FormLabel>Cultural Files (Mandatory)</FormLabel>
              <Input type="file" multiple accept=".pdf,.jpg" onChange={(e) => handleFileChange(e, setCulturalFiles)} />
            </FormControl>

            <FormControl mt={4}>
              <FormLabel>Academic Files (Optional)</FormLabel>
              <Input type="file" multiple onChange={(e) => handleFileChange(e, setAcademicFiles)} />
            </FormControl>

            <FormControl mt={4}>
              <FormLabel>Other Files (Optional)</FormLabel>
              <Input type="file" multiple onChange={(e) => handleFileChange(e, setOtherFiles)} />
            </FormControl>
          </Box>

          {/* Checkboxes */}
          <VStack mt={4} align="start" spacing={3}>
            <Checkbox isChecked={notOnProbation} onChange={(e) => setNotOnProbation(e.target.checked)} colorScheme="blue">Not on Probation</Checkbox>
            <Checkbox isChecked={readHandbook} onChange={(e) => setReadHandbook(e.target.checked)} colorScheme="blue">I have read the handbook</Checkbox>
            <Checkbox isChecked={trueStatement} onChange={(e) => setTrueStatement(e.target.checked)} colorScheme="blue">I confirm that the above statements are true</Checkbox>
          </VStack>

          <MotionButton
            mt={6}
            onClick={handleSubmit}
            isLoading={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition="0.12s"
            {...(useColorModeValue(primaryButtonLight, primaryButtonDark))}
          >
            Submit
          </MotionButton>
        </motion.div>
      )}

      {/* Sport modal */}
      <Modal isOpen={isSportModalOpen} onClose={onSportModalClose} size={{ base: 'full', md: 'xl' }}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Sport Score Sheet</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>Sheet content here (fetch via API)</Text>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onSportModalClose} {...(useColorModeValue(primaryButtonLight, primaryButtonDark))}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Cultural modal */}
      <Modal isOpen={isCulturalModalOpen} onClose={onCulturalModalClose} size={{ base: 'full', md: 'xl' }}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Cultural Score Sheet</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>Sheet content here (fetch via API)</Text>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onCulturalModalClose} {...(useColorModeValue(primaryButtonLight, primaryButtonDark))}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Photo Upload Modal */}
      <Modal isOpen={isPhotoModalOpen} onClose={onPhotoModalClose} size="sm">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Upload Photo</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={2} align="start">
              {photoInstructions.map((instr, idx) => (
                <Text key={idx}>{instr}</Text>
              ))}
              <Input type="file" accept="image/jpeg,image/jpg,image/png" onChange={handlePhotoChange} />
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onPhotoModalClose} {...(useColorModeValue(primaryButtonLight, primaryButtonDark))}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

export default ApplicationFormDashboard;
