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
import { ChevronDownIcon } from '@chakra-ui/icons';
import { FaMale, FaFemale } from 'react-icons/fa'; // Updated imports for gender icons
import PageHeader from '../components/layout/PageHeader'; // Assuming this is available
import { formSubmissionService } from '../services/formSubmissionService'; // As provided
import { authService } from '../services/authService'; // Import the modified authService
import { positionService } from '../services/positionService';

// Import logo
import flameLogo from '../assets/img/FLAME.png';

// Placeholder for profile photo if none
const defaultProfilePhoto = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

function ApplicationFormDashboard() {
  const toast = useToast();
  const { isOpen: isSportModalOpen, onOpen: onSportModalOpen, onClose: onSportModalClose } = useDisclosure();
  const { isOpen: isCulturalModalOpen, onOpen: onCulturalModalOpen, onClose: onCulturalModalClose } = useDisclosure();
  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'white');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // User data from API
  const [user, setUser] = useState(null);
  const [agreedToInstructions, setAgreedToInstructions] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isApplicationOpen, setIsApplicationOpen] = useState(true); // Placeholder, fetch from API
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
        // Proceed with empty user object to avoid white screen
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

    // Fetch application time settings (simulate or use API)
    // For now, assume open
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
      Photo: photo ? photo.name : user?.photoUrl.split('/').pop().split('.jpg')[0], // Extract filename if uploading new, else keep existing
      // Files would need separate upload, perhaps to a file API, then save paths
      // For simplicity, assume service handles formData with files
    };

    try {
      await formSubmissionService.create(formData);
      toast({ title: 'Form submitted successfully', status: 'success', duration: 3000 });
      // Redirect or something
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
    <Box p={8} bg={bgColor} color={textColor}>
      <PageHeader title="Candidate Application Form" description="Apply for student council positions" />

      {!showForm ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <Card bg={bgColor} border="1px" borderColor={borderColor} mb={6}>
            <CardHeader>
              <Text fontSize="xl" fontWeight="bold">Instructions</Text>
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
          <Checkbox isChecked={agreedToInstructions} onChange={handleAgreementChange}>
            I have read and agree to the instructions and terms outlined above.
          </Checkbox>
        </motion.div>
      ) : (
        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
          {/* Top Section */}
          <HStack justify="space-between" mb={8} p={4} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md" border="1px" borderColor={borderColor}>
            <HStack spacing={4}>
              <Image
                src={photo ? URL.createObjectURL(photo) : user?.photoUrl || defaultProfilePhoto}
                alt="Profile Photo"
                borderRadius="full"
                boxSize="100px"
                objectFit="cover"
              />
              <VStack align="start">
                <HStack>
                  <Text fontSize="2xl" fontWeight="bold">{user?.name || 'Name'}</Text>
                  <GenderIcon />
                </HStack>
                <Text fontSize="md">{user?.email || 'Email'}</Text>
                <Text fontSize="md">{user?.mobileNumber || 'Mobile Number'}</Text>
                <Text fontSize="sm" color="gray.500">Student ID: {user?.studentId || 'ID'}</Text>
                <Text fontSize="sm" color="gray.500">Batch: {user?.batch || 'Batch'}</Text>
              </VStack>
            </HStack>
            <Image src={flameLogo} alt="FLAME University Logo" boxSize="100px" />
          </HStack>

          {/* Form Fields */}
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            <FormControl>
              <FormLabel>Position Interested</FormLabel>
              <Menu>
                <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
                  {position || 'Select a position'}
                </MenuButton>
                <MenuList maxH="200px" overflowY="auto">
                  {positions.map((pos) => (
                    <MenuItem key={pos.id} onClick={() => setPosition(pos.description)}>
                      {pos.description}
                    </MenuItem>
                  ))}
                </MenuList>
              </Menu>
            </FormControl>
            <FormControl>
              <FormLabel>CGPA - Academics Score</FormLabel>
              <Input type="number" value={cgpa} onChange={(e) => setCgpa(e.target.value)} />
            </FormControl>
          </SimpleGrid>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mt={4}>
            <FormControl>
              <FormLabel>Sports Score</FormLabel>
              <Button onClick={onSportModalOpen} leftIcon={<Icon as={ArrowRightIcon} />}>Open Sport Sheet</Button>
              <Input mt={2} type="number" placeholder="Enter raw score" onChange={handleSportsScoreChange} />
              <Text mt={1}>Calculated: {sportsScore}/10</Text>
            </FormControl>
            <FormControl>
              <FormLabel>Cultural Score</FormLabel>
              <Button onClick={onCulturalModalOpen} leftIcon={<Icon as={ArrowRightIcon} />}>Open Cultural Sheet</Button>
              <Input mt={2} type="number" placeholder="Enter raw score" onChange={handleCulturalScoreChange} />
              <Text mt={1}>Calculated: {culturalScore}/10</Text>
            </FormControl>
          </SimpleGrid>

          <FormControl mt={4}>
            <FormLabel>Community Service</FormLabel>
            <Textarea value={communityService} onChange={(e) => setCommunityService(e.target.value)} />
          </FormControl>

          <FormControl mt={4}>
            <FormLabel>Statement of Purpose</FormLabel>
            <Textarea value={statementOfPurpose} onChange={(e) => setStatementOfPurpose(e.target.value)} />
          </FormControl>

          {/* Uploads */}
          <Card mt={6}>
            <CardHeader>Uploads</CardHeader>
            <CardBody>
              <Alert status="warning" mb={4}>
                <AlertIcon />
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
          <VStack mt={4} align="start">
            <Checkbox isChecked={notOnProbation} onChange={(e) => setNotOnProbation(e.target.checked)}>(I am) Not on Probation</Checkbox>
            <Checkbox isChecked={readHandbook} onChange={(e) => setReadHandbook(e.target.checked)}>I Read the Handbook</Checkbox>
            <Checkbox isChecked={trueStatement} onChange={(e) => setTrueStatement(e.target.checked)}>I confirm that the above statements are true</Checkbox>
          </VStack>

          <Button mt={6} colorScheme="blue" onClick={handleSubmit} isLoading={loading}>Submit</Button>
        </motion.div>
      )}

      {/* Modals for Sheets */}
      <Modal isOpen={isSportModalOpen} onClose={onSportModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Sport Score Sheet</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {/* Fetch and display sheet, perhaps iframe or content */}
            <Text>Sheet content here (fetch via API)</Text>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onSportModalClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isCulturalModalOpen} onClose={onCulturalModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Cultural Score Sheet</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>Sheet content here (fetch via API)</Text>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onCulturalModalClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

export default ApplicationFormDashboard;