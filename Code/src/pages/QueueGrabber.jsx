import { useState, useEffect, useCallback } from 'react';
import { io } from "socket.io-client";
import {
  Box,
  SimpleGrid,
  Card,
  CardBody,
  CardHeader,
  Icon,
  Text,
  VStack,
  HStack,
  useColorModeValue,
  Table as ChakraTable,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  TableContainer,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton,
} from '@chakra-ui/react';
import { FaClock, FaUserPlus, FaCalendarCheck, FaCheckCircle, FaHandPaper, FaStop, FaArrowRight } from 'react-icons/fa';
import { queueDashboardService } from '../services/QueueDashboardService';
import { emitGrabGesture } from '../services/Gesture';

const socket = io('http://192.168.8.10:8082');

function QueueGrabber() {
  const [waitingQueues, setWaitingQueues] = useState([]);
  const [activeQueues, setActiveQueues] = useState([]);
  const [completedQueues, setCompletedQueues] = useState([]);
  const [counters, setCounters] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [fontSize, setFontSize] = useState('md');

  // Adjust font sizes based on screen resolution
  useEffect(() => {
    const updateFontSize = () => {
      const width = window.innerWidth;
      if (width >= 1920) {
        setFontSize('xl'); // Large font for 1080p or higher
      } else if (width >= 1280) {
        setFontSize('lg'); // Medium font for 720p
      } else {
        setFontSize('md'); // Default for smaller screens
      }
    };
    updateFontSize();
    window.addEventListener('resize', updateFontSize);
    return () => window.removeEventListener('resize', updateFontSize);
  }, []);

  // Fetch counters
  const fetchCounters = useCallback(async () => {
    try {
      const countersData = await queueDashboardService.getDepartmentCounters();
      setCounters(countersData);
    } catch (error) {
      console.error('Failed to fetch counters:', error);
    }
  }, []);

  // Debounced fetchData to prevent frequent updates
  const fetchData = useCallback(async () => {
    try {
      const [waiting, active, completed] = await Promise.all([
        queueDashboardService.getWaitingQueues(),
        queueDashboardService.getActiveQueues(),
        queueDashboardService.getCompletedQueues(),
      ]);
      setWaitingQueues(waiting);
      setActiveQueues(active);
      setCompletedQueues(completed);
    } catch (error) {
      console.error('Failed to fetch queue data:', error);
    }
  }, []);

  useEffect(() => {
    fetchCounters();
    fetchData();

    let debounceTimeout;
    socket.on('queueUpdate', () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        fetchData();
      }, 1000); // Debounce updates by 1 second
    });

    const timeInterval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => {
      socket.off('queueUpdate');
      clearTimeout(debounceTimeout);
      clearInterval(timeInterval);
    };
  }, [fetchData, fetchCounters]);

  const handleSetQueueOn = async (id) => {
    try {
      await queueDashboardService.setQueueOn(id);
      emitGrabGesture(); // Emit gesture event when grab icon is clicked
      fetchData();
    } catch (error) {
      console.error('Failed to set queue to ON:', error);
    }
  };

  const handleSetQueueOff = async (id) => {
    try {
      await queueDashboardService.setQueueOff(id);
      fetchData();
    } catch (error) {
      console.error('Failed to set queue to OFF:', error);
    }
  };

  const handleMoveQueue = async (queueId, newCounterId) => {
    try {
      await queueDashboardService.moveQueueToCounter(queueId, newCounterId);
      fetchData();
    } catch (error) {
      console.error('Failed to move queue to new counter:', error);
    }
  };

  return (
    <Box p={{ base: 4, md: 8 }} bg={useColorModeValue('gray.50', 'gray.800')}>
      <Card mb={4} shadow="md" borderWidth="1px">
        <CardBody>
          <HStack justifyContent="space-between">
            <Text fontSize={fontSize === 'xl' ? '2xl' : 'xl'} fontWeight="bold">
              <Icon as={FaClock} mr={2} /> Service Queue Grabber
            </Text>
            <Text fontSize={fontSize}>{new Date().toLocaleDateString()} {currentTime}</Text>
          </HStack>
        </CardBody>
      </Card>

      <SimpleGrid
        columns={{ base: 1, md: 3 }}
        spacing={6}
        templateColumns={{ base: '1fr', md: '1fr 1.5fr 0.75fr' }}
      >
        <Card shadow="md" borderWidth="1px">
          <CardHeader>
            <Text fontSize={fontSize === 'xl' ? 'xl' : 'lg'} fontWeight="bold">
              <Icon as={FaUserPlus} mr={2} /> Waiting Queue
            </Text>
          </CardHeader>
          <CardBody>
            <TableContainer maxH="400px" overflowY="auto">
              <ChakraTable variant="simple">
                <Thead>
                  <Tr>
                    <Th fontSize={fontSize}>Student ID</Th>
                    <Th fontSize={fontSize}>Name</Th>
                    <Th fontSize={fontSize}>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {waitingQueues.map((queue) => (
                    <Tr key={queue.id}>
                      <Td fontSize={fontSize}>{queue.EmployeeId}</Td>
                      <Td fontSize={fontSize}>{queue.EmployeeName}</Td>
                      <Td>
                        <Button
                          size="sm"
                          colorScheme="green"
                          fontSize={fontSize}
                          leftIcon={<Icon as={FaHandPaper} />}
                          onClick={() => handleSetQueueOn(queue.id)}
                        >
                          Select
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </ChakraTable>
            </TableContainer>
          </CardBody>
        </Card>

        <Card shadow="md" borderWidth="1px">
          <CardHeader>
            <Text fontSize={fontSize === 'xl' ? 'xl' : 'lg'} fontWeight="bold">
              <Icon as={FaCalendarCheck} mr={2} /> Active Services
            </Text>
          </CardHeader>
          <CardBody>
            <TableContainer maxH="400px" overflowY="auto">
              <ChakraTable variant="simple">
                <Thead>
                  <Tr>
                    <Th fontSize={fontSize}>Student ID</Th>
                    <Th fontSize={fontSize}>Name</Th>
                    <Th fontSize={fontSize}>Counter</Th>
                    <Th fontSize={fontSize}>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {activeQueues.map((queue) => (
                    <Tr key={queue.id}>
                      <Td fontSize={fontSize}>{queue.EmployeeId}</Td>
                      <Td fontSize={fontSize}>{queue.EmployeeName}</Td>
                      <Td fontSize={fontSize}>{queue.Counter ? queue.Counter.CounterName : 'N/A'}</Td>
                      <Td>
                        <HStack spacing={2}>
                          <Menu>
                            <MenuButton
                              as={IconButton}
                              icon={<FaArrowRight />}
                              variant="outline"
                              size="sm"
                              aria-label="Move to next counter"
                            />
                            <MenuList>
                              {counters
                                .filter(counter => counter.id !== queue.CounterId)
                                .map(counter => (
                                  <MenuItem
                                    key={counter.id}
                                    onClick={() => handleMoveQueue(queue.id, counter.id)}
                                  >
                                    {counter.CounterName}
                                  </MenuItem>
                                ))}
                            </MenuList>
                          </Menu>
                          <IconButton
                            icon={<FaStop />}
                            colorScheme="red"
                            size="sm"
                            aria-label="End service"
                            onClick={() => handleSetQueueOff(queue.id)}
                          />
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </ChakraTable>
            </TableContainer>
          </CardBody>
        </Card>

        <Card shadow="md" borderWidth="1px">
          <CardHeader>
            <Text fontSize={fontSize === 'xl' ? 'xl' : 'lg'} fontWeight="bold">
              <Icon as={FaCheckCircle} mr={2} /> Completed Services
            </Text>
          </CardHeader>
          <CardBody>
            <TableContainer maxH="400px" overflowY="auto">
              <ChakraTable variant="simple">
                <Thead>
                  <Tr>
                    <Th fontSize={fontSize}>Student ID</Th>
                    <Th fontSize={fontSize}>Name</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {completedQueues.map((queue) => (
                    <Tr key={queue.id}>
                      <Td fontSize={fontSize}>{queue.EmployeeId}</Td>
                      <Td fontSize={fontSize}>{queue.EmployeeName}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </ChakraTable>
            </TableContainer>
          </CardBody>
        </Card>
      </SimpleGrid>
    </Box>
  );
}

export default QueueGrabber;
