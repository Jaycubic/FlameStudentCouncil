import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { io } from "socket.io-client";
import {
  Box,
  SimpleGrid,
  Card,
  CardBody,
  CardHeader,
  Button,
  Icon,
  Text,
  HStack,
  useDisclosure,
  useColorModeValue,
  Table as ChakraTable,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  useToast,
} from '@chakra-ui/react';
import { FaClock, FaUserPlus, FaCalendarCheck, FaTrash } from 'react-icons/fa';
import { queueDashboardService } from '../services/QueueDashboardService';

const socket = io('http://192.168.8.10:8082');

function QueueDashboard() {
  const [waitingQueues, setWaitingQueues] = useState([]);
  const [activeQueues, setActiveQueues] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [fontSize, setFontSize] = useState('md');
  const toast = useToast();
  const audio = useMemo(
    () => new Audio('http://192.168.8.10:8082/api/queue-dashboard/sounds/ding-dong.wav'),
    []
  );
  const prevActiveQueuesRef = useRef([]);

  // toggle zoom + video
  const [videoVisible, setVideoVisible] = useState(false);

  // fetch & socket
  const fetchData = useCallback(async () => {
    try {
      const [waiting, newActive] = await Promise.all([
        queueDashboardService.getWaitingQueues(),
        queueDashboardService.getActiveQueuesForDashboard(),
      ]);
      const prevActiveMap = new Map(prevActiveQueuesRef.current.map(q => [q.id, q.CounterId]));
      const updatedActive = newActive.map(q => ({
        ...q,
        counterChanged: prevActiveMap.has(q.id) && prevActiveMap.get(q.id) !== q.CounterId
      }));
      setWaitingQueues(waiting);
      setActiveQueues(updatedActive);
    } catch (e) {
      console.error('Failed to fetch queue data:', e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    let debounce;
    socket.on('queueUpdate', () => {
      clearTimeout(debounce);
      debounce = setTimeout(fetchData, 1000);
      setVideoVisible(false);
      setTimeout(() => setVideoVisible(true), 15000);
    });
    socket.on('grabGesture', () => {
      audio.play().catch(() => { });
    });
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    setTimeout(() => setVideoVisible(true), 15000);

    return () => {
      socket.off('queueUpdate');
      socket.off('grabGesture');
      clearTimeout(debounce);
      clearInterval(clockTimer);
    };
  }, [fetchData, audio]);

  useEffect(() => {
    prevActiveQueuesRef.current = activeQueues.map(q => ({ id: q.id, CounterId: q.CounterId }));
  }, [activeQueues]);

  // handlers
  const handleSetQueueOn = id => queueDashboardService.setQueueOn(id).then(fetchData).catch(console.error);
  const handleSetQueueOff = id => queueDashboardService.setQueueOff(id).then(fetchData).catch(console.error);
  const handleDeleteQueue = async id => {
    try {
      await queueDashboardService.deleteQueue(id);
      fetchData();
      toast({ title: 'Queue deleted.', status: 'success', duration: 3000 });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error deleting', status: 'error', duration: 3000 });
    }
  };

  // responsive fonts
  useEffect(() => {
    const upd = () => {
      const w = window.innerWidth;
      setFontSize(w >= 1920 ? 'xl' : w >= 1280 ? 'lg' : 'md');
    };
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);

  return (
    <Box position="relative" p={{ base: 4, md: 8 }} bg={useColorModeValue('gray.50', 'gray.800')}>
      {/* inline CSS */}
      <style>{`
        @keyframes scrollUp { 0% {transform:translateY(0);} 100% {transform:translateY(-50%);} }
        .scroll-container { overflow:hidden; height:300px; }
        .scroll-content { animation:scrollUp 20s linear infinite; }
        @keyframes fadeSlideIn { from{opacity:0; transform:translateY(10px);} to{opacity:1; transform:translateY(0);} }
        .fade-slide-in { animation:fadeSlideIn 0.6s ease forwards; }
        @keyframes pulse { 0%{box-shadow:0 0 0 rgba(0,123,255,0.7);} 70%{box-shadow:0 0 10px rgba(0,123,255,0);} 100%{box-shadow:0 0 0 rgba(0,123,255,0);} }
        .active-pulse { animation:pulse 1.5s infinite; }
        .zoom-active { transform: scale(0.9); transform-origin: top center; transition: transform 0.5s ease; }
        .normal-active { transform: scale(1); transition: transform 0.5s ease; }
        @keyframes heartbeat { 0% {transform:scale(1);} 25% {transform:scale(1.05);} 50% {transform:scale(1);} 75% {transform:scale(1.05);} 100% {transform:scale(1);} }
        .heartbeat { animation:heartbeat 1s ease-in-out; }
      `}</style>

      {/* Header */}
      <Card mb={4} shadow="md" borderWidth="1px">
        <CardBody>
          <HStack justify="space-between">
            <Text fontSize={fontSize === 'xl' ? '2xl' : 'xl'} fontWeight="bold">
              <Icon as={FaClock} mr={2} />Service Queue Dashboard
            </Text>
            <Text fontSize={fontSize}>{new Date().toLocaleDateString()} {currentTime}</Text>
          </HStack>
        </CardBody>
      </Card>

      {/* Grid */}
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
        {/* Waiting */}
        <Card shadow="md" borderWidth="1px">
          <CardHeader>
            <HStack justify="space-between">
              <Text fontSize={fontSize === 'xl' ? 'xl' : 'lg'} fontWeight="bold">
                <Icon as={FaUserPlus} mr={2} />Waiting Queue
              </Text>
              <Button leftIcon={<Icon as={FaUserPlus} />} colorScheme="blue" fontSize={fontSize} onClick={onOpen}>
                Add Student
              </Button>
            </HStack>
          </CardHeader>
          <CardBody className="scroll-container">
            <ChakraTable variant="simple" className="scroll-content">
              <Thead>
                <Tr><Th fontSize={fontSize}>Student ID</Th><Th fontSize={fontSize}>Name</Th><Th fontSize={fontSize}>Actions</Th></Tr>
              </Thead>
              <Tbody>
                {waitingQueues.map(q => (
                  <Tr key={q.id} className="fade-slide-in">
                    <Td fontSize={fontSize}>{q.EmployeeId}</Td>
                    <Td fontSize={fontSize}>{q.EmployeeName}</Td>
                    <Td>
                      <Button size="sm" colorScheme="red" fontSize={fontSize} leftIcon={<Icon as={FaTrash} />} onClick={() => handleDeleteQueue(q.id)}>
                        Delete
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </ChakraTable>
          </CardBody>
        </Card>

        {/* Active */}
        <Card shadow="md" borderWidth="1px" className={videoVisible ? 'zoom-active' : 'normal-active'}>
          <CardHeader>
            <Text fontSize={fontSize === 'xl' ? 'xl' : 'lg'} fontWeight="bold">
              <Icon as={FaCalendarCheck} mr={2} />Active Services
            </Text>
          </CardHeader>
          <CardBody>
            <ChakraTable variant="simple">
              <Thead>
                <Tr><Th fontSize={fontSize}>Student ID</Th><Th fontSize={fontSize}>Name</Th><Th fontSize={fontSize}>Counter</Th><Th fontSize={fontSize}>Actions</Th></Tr>
              </Thead>
              <Tbody>
                {activeQueues.map(q => (
                  <Tr key={q.id} className={`active-pulse ${q.counterChanged ? 'heartbeat' : ''}`}>
                    <Td fontSize={fontSize}>{q.EmployeeId}</Td>
                    <Td fontSize={fontSize}>{q.EmployeeName}</Td>
                    <Td fontSize={fontSize}>{q.Counter?.CounterName ?? 'N/A'}</Td>
                    <Td>
                      <Button size="sm" colorScheme="red" fontSize={fontSize} onClick={() => handleSetQueueOff(q.id)}>
                        End
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </ChakraTable>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Video frame fixed bottom-right */}
      {videoVisible && (
        <Box
          position="fixed"
          bottom="24px"
          right="24px"
          width={{ base: '95vw', md: '45vw', lg: '40vw' }}
          height={{ base: '180px', md: '240px', lg: '300px' }}
          borderRadius="md"
          overflow="hidden"
          boxShadow="lg"
          bg="black"
          zIndex={10}
        >
          <iframe
            width="100%"
            height="100%"
            src="https://www.youtube.com/embed/VvHQ3YvBito?autoplay=1&mute=1&loop=1&playlist=VvHQ3YvBito"
            title="FLAME University | A World of Everlasting Opportunities"
            frameBorder="0"
            allow="autoplay; encrypted-media; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </Box>
      )}

      {/* Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontSize={fontSize}>Add Student to Queue</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize={fontSize}>Manual queue creation to be implemented.</Text>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} fontSize={fontSize} onClick={onClose}>Save</Button>
            <Button variant="ghost" fontSize={fontSize} onClick={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

export default QueueDashboard;
