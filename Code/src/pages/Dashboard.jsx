import { useState, useEffect } from 'react';
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
  Card,
  CardBody,
  CardHeader,
  Alert,
  AlertIcon,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from '@chakra-ui/react';
import { CheckIcon, ArrowRightIcon, UserIcon } from '@heroicons/react/24/outline';
import { ChevronDownIcon, ChevronUpIcon, AddIcon } from '@chakra-ui/icons';
import { FaMale, FaFemale } from 'react-icons/fa';
import PageHeader from '../components/layout/PageHeader';
import { formSubmissionService } from '../services/formSubmissionService';
import { authService } from '../services/authService';
import { positionService } from '../services/positionService';

// Import logo
import flameLogo from '../assets/img/FLAME.png';

// Placeholder for profile photo if none
const defaultProfilePhoto = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

function ApplicationFormDashboard() {
  const toast = useToast();
  const { isOpen: isSportModalOpen, onOpen: onSportModalOpen, onClose: onSportModalClose } = useDisclosure();
  const { isOpen: isCulturalModalOpen, onOpen: onCulturalModalOpen, onClose: onCulturalModalClose } = useDisclosure();
  const { isOpen: isCommunityExpanded, onOpen: onCommunityExpand, onClose: onCommunityCollapse } = useDisclosure();
  const { isOpen: isSopExpanded, onOpen: onSopExpand, onClose: onSopCollapse } = useDisclosure();
  const { isOpen: isPhotoModalOpen, onOpen: onPhotoModalOpen, onClose: onPhotoModalClose } = useDisclosure();
  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'white');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const gradientBorder = useColorModeValue(
    'linear-gradient(135deg, #1e40af 0%, #2563eb 100%, #38bdf8 50%)',
    'linear(to-b, purple.700, pink.500)'
  );
  const hoverGradient = useColorModeValue(
    'linear(to-r, blue.300, blue.200)',
    'linear(to-r, purple.500, pink.300)'
  );
  const activeGradient = useColorModeValue(
    'linear(to-r, blue.500, blue.400)',
    'linear(to-r, purple.600, pink.400)'
  );

  // User data from API
  const [user, setUser] = useState(null);
  const [agreedToInstructions, setAgreedToInstructions] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isApplicationOpen, setIsApplicationOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  // Form states
  const [position, setPosition] = useState('');
  const [cgpa, setCgpa] = useState('');
  const [sportsScore, setSportsScore] = useState('');
  const [culturalScore, setCulturalScore] = useState('');
  const [communityService, setCommunityService] = useState('');
  const [statementOfPurpose, setStatementOfPurpose] = useState('');
  const [notOnProbation, setNotOnProbation] = useState(false);
  const [readHandbook, setReadHandbook] = useState(false);
  const [trueStatement, setTrueStatement] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [sportFiles, setSportFiles] = useState([]);
  const [culturalFiles, setCulturalFiles] = useState([]);
  const [academicFiles, setAcademicFiles] = useState([]);
  const [otherFiles, setOtherFiles] = useState([]);

  // Positions from backend
  const [positions, setPositions] = useState([]);

  // Instructions
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
          name: currentUser.studentName || '',
          studentId: currentUser.studentCvueNo || '',
          mobileNumber: currentUser.contactNo || '',
          email: currentUser.email || '',
          batch: currentUser.batch || '',
          gender: currentUser.gender || '',
          photoUrl: currentUser.photo ? `https://flamestudentcouncil.in:5050/photos/${currentUser.photo}.jpg` : defaultProfilePhoto,
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
  }, []);

  const handleAgreementChange = (e) => {
    const checked = e.target.checked;
    setAgreedToInstructions(checked);
    localStorage.setItem('agreedToInstructions', checked);
    if (checked) {
      setShowForm(true);
    }
  };

  const handlePhotoChange = (e) => {
    setPhoto(e.target.files[0]);
  };

  const handleFileChange = (e, setter) => {
    setter(Array.from(e.target.files));
  };

  const calculateScore = (score) => {
    let scaledScore;
    if (score <= 100) {
      scaledScore = score / 10;
    } else {
      const decayFactor = (score - 100) * 0.05;
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
      Photo: photo ? photo.name : user?.photoUrl.split('/').pop().split('.jpg')[0],
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
    return <Icon as={UserIcon} color="gray.500" boxSize={6} />;
  };

  if (loading) {
    return (
      <Box p={8} textAlign="center">
        <CircularProgress isIndeterminate color="blue.500" />
        <Text mt={4}>Loading application...</Text>
      </Box>
    );
  }

  if (!isApplicationOpen) {
    return (
      <Box p={8} textAlign="center">
        <Alert status="error">
          <AlertIcon />
          Application period has ended.
        </Alert>
      </Box>
    );
  }

  return (
    <Box p={{ base: 4, md: 8 }} bg={bgColor} color={textColor} borderRadius="xl" boxShadow="xl">
      <PageHeader title="Candidate Application Form" description="Apply for student council positions" />

      {!showForm ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <Card bg={bgColor} border="1px" borderColor={borderColor} mb={6} borderRadius="lg" bgGradient={gradientBorder} p={4}>
            <CardHeader>
              <Text fontSize="xl" fontWeight="bold" color="white">Instructions</Text>
            </CardHeader>
            <CardBody>
              <List spacing={3}>
                {instructions.map((instr, idx) => (
                  <ListItem key={idx}>
                    <Icon as={CheckIcon} color="green.500" mr={2} />
                    {instr}
                  </ListItem>
                ))}
              </List>
            </CardBody>
          </Card>
          <Checkbox isChecked={agreedToInstructions} onChange={handleAgreementChange} colorScheme="blue">
            I have read and agree to the instructions and terms outlined above.
          </Checkbox>
        </motion.div>
      ) : (
        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
          {/* Top Section */}
          <HStack justify="space-between" mb={8} p={4} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md" border="1px" borderColor={borderColor} bgGradient={gradientBorder} flexWrap={{ base: 'wrap', md: 'nowrap' }}>
            <HStack spacing={4} flex="1" justify={{ base: 'center', md: 'flex-start' }} w="full">
              <Image
                src={photo ? URL.createObjectURL(photo) : user?.photoUrl || defaultProfilePhoto}
                alt="Profile Photo"
                borderRadius="full"
                boxSize={{ base: '80px', md: '100px' }}
                objectFit="cover"
                cursor={user?.photoUrl === defaultProfilePhoto ? 'pointer' : 'default'}
                onClick={user?.photoUrl === defaultProfilePhoto ? onPhotoModalOpen : undefined}
                _hover={{ transform: 'scale(1.05)', transition: '0.2s' }}
              />
              <VStack align="start">
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
                <MenuButton as={Button} rightIcon={<ChevronDownIcon />} bgGradient={gradientBorder} color="white" _hover={{ bgGradient: hoverGradient }} _active={{ bgGradient: activeGradient }}>
                  {position || 'Select a position'}
                </MenuButton>
                <MenuList maxH="200px" overflowY="auto">
                  {positions.map((pos) => (
                    <MenuItem key={pos.id} onClick={() => setPosition(pos.description)} _hover={{ bgGradient: hoverGradient }}>
                      {pos.description}
                    </MenuItem>
                  ))}
                </MenuList>
              </Menu>
            </FormControl>
            <FormControl>
              <FormLabel>CGPA - Academics Score</FormLabel>
              <Input type="number" value={cgpa} onChange={(e) => setCgpa(e.target.value)} borderColor={borderColor} _hover={{ borderColor: 'blue.400' }} transition="0.2s" />
            </FormControl>
          </SimpleGrid>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mt={4}>
            <FormControl>
              <FormLabel>Sports Score</FormLabel>
              <Button onClick={onSportModalOpen} leftIcon={<Icon as={ArrowRightIcon} />} bgGradient={gradientBorder} color="white" _hover={{ bgGradient: hoverGradient, transform: 'translateX(4px)' }} transition="0.2s">Open Sport Sheet</Button>
              <Input mt={2} type="number" placeholder="Enter raw score" onChange={handleSportsScoreChange} borderColor={borderColor} _hover={{ borderColor: 'blue.400' }} transition="0.2s" />
              <Text mt={1}>Calculated: {sportsScore}/10</Text>
            </FormControl>
            <FormControl>
              <FormLabel>Cultural Score</FormLabel>
              <Button onClick={onCulturalModalOpen} leftIcon={<Icon as={ArrowRightIcon} />} bgGradient={gradientBorder} color="white" _hover={{ bgGradient: hoverGradient, transform: 'translateX(4px)' }} transition="0.2s">Open Cultural Sheet</Button>
              <Input mt={2} type="number" placeholder="Enter raw score" onChange={handleCulturalScoreChange} borderColor={borderColor} _hover={{ borderColor: 'blue.400' }} transition="0.2s" />
              <Text mt={1}>Calculated: {culturalScore}/10</Text>
            </FormControl>
          </SimpleGrid>

          <FormControl mt={4} position="relative">
            <FormLabel>Community Service</FormLabel>
            <IconButton icon={<Icon as={isCommunityExpanded ? ChevronUpIcon : ChevronDownIcon} />} position="absolute" right="2" top="8" size="sm" onClick={onCommunityExpand} aria-label="Expand Community Service" />
            <Textarea value={communityService} onChange={(e) => setCommunityService(e.target.value)} rows={3} borderColor={borderColor} _hover={{ borderColor: 'blue.400' }} transition="0.2s" />
          </FormControl>

          <FormControl mt={4} position="relative">
            <FormLabel>Statement of Purpose</FormLabel>
            <IconButton icon={<Icon as={isSopExpanded ? ChevronUpIcon : ChevronDownIcon} />} position="absolute" right="2" top="8" size="sm" onClick={onSopExpand} aria-label="Expand Statement of Purpose" />
            <Textarea value={statementOfPurpose} onChange={(e) => setStatementOfPurpose(e.target.value)} rows={3} borderColor={borderColor} _hover={{ borderColor: 'blue.400' }} transition="0.2s" />
          </FormControl>

          {/* Uploads */}
          <Card mt={6} borderRadius="lg" bgGradient={gradientBorder} p={4} color="white">
            <CardHeader>Uploads</CardHeader>
            <CardBody>
              <Alert status="warning" mb={4} variant="subtle" bg="transparent" color="white">
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
            </CardBody>
          </Card>

          {/* Checkboxes */}
          <VStack mt={4} align="start" spacing={3}>
            <Checkbox isChecked={notOnProbation} onChange={(e) => setNotOnProbation(e.target.checked)} colorScheme="blue">(I am) Not on Probation</Checkbox>
            <Checkbox isChecked={readHandbook} onChange={(e) => setReadHandbook(e.target.checked)} colorScheme="blue">I Read the Handbook</Checkbox>
            <Checkbox isChecked={trueStatement} onChange={(e) => setTrueStatement(e.target.checked)} colorScheme="blue">I confirm that the above statements are true</Checkbox>
          </VStack>

          <Button mt={6} colorScheme="blue" onClick={handleSubmit} isLoading={loading} bgGradient={gradientBorder} _hover={{ bgGradient: hoverGradient }} transition="0.2s">Submit</Button>
        </motion.div>
      )}

      {/* Modals for Sheets */}
      <Modal isOpen={isSportModalOpen} onClose={onSportModalClose} size={{ base: 'full', md: 'xl' }}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Sport Score Sheet</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>Sheet content here (fetch via API)</Text>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onSportModalClose} bgGradient={gradientBorder} _hover={{ bgGradient: hoverGradient }}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isCulturalModalOpen} onClose={onCulturalModalClose} size={{ base: 'full', md: 'xl' }}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Cultural Score Sheet</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>Sheet content here (fetch via API)</Text>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onCulturalModalClose} bgGradient={gradientBorder} _hover={{ bgGradient: hoverGradient }}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Expanded Community Service */}
      <Modal isOpen={isCommunityExpanded} onClose={onCommunityCollapse} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Community Service</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Textarea value={communityService} onChange={(e) => setCommunityService(e.target.value)} rows={15} />
          </ModalBody>
          <ModalFooter>
            <Button onClick={onCommunityCollapse} bgGradient={gradientBorder} _hover={{ bgGradient: hoverGradient }}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Expanded SOP */}
      <Modal isOpen={isSopExpanded} onClose={onSopCollapse} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Statement of Purpose</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Textarea value={statementOfPurpose} onChange={(e) => setStatementOfPurpose(e.target.value)} rows={15} />
          </ModalBody>
          <ModalFooter>
            <Button onClick={onSopCollapse} bgGradient={gradientBorder} _hover={{ bgGradient: hoverGradient }}>Close</Button>
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
            <Button onClick={onPhotoModalClose} bgGradient={gradientBorder} _hover={{ bgGradient: hoverGradient }}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

export default ApplicationFormDashboard;