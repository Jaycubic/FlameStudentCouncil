import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from "socket.io-client";
import { motion } from 'framer-motion';
import {
  Box,
  SimpleGrid,
  Card,
  CardBody,
  CardHeader,
  IconButton,
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
  Button,
  Icon,
  Text,
  VStack,
  HStack,
  useDisclosure,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  UserGroupIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  CheckCircleIcon,
  ArrowsPointingOutIcon,
} from '@heroicons/react/24/outline';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import PageHeader from '../components/layout/PageHeader';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const MotionCard = motion(Card);

function StatCard({ title, stat, icon, color }) {
  const bgColor = useColorModeValue('white', 'gray.800');
  const titleTextColor = useColorModeValue('gray.600', 'gray.400');
  const statTextColor = useColorModeValue(color, color);
  const iconBg = useColorModeValue('gray.100', 'gray.700');
  return (
    <MotionCard
      bg={bgColor}
      border="1px solid"
      borderColor={useColorModeValue('#e5e7eb', 'gray.600')}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.2 }}
    >
      <CardBody>
        <HStack spacing={4}>
          <Box p={3} bg={iconBg} borderRadius="lg">
            <Icon as={icon} boxSize={6} color={statTextColor} />
          </Box>
          <Box flex={1}>
            <Text fontSize="sm" color={titleTextColor}>{title}</Text>
            <Text fontSize="2xl" fontWeight="bold" color={statTextColor}>{stat}</Text>
          </Box>
        </HStack>
      </CardBody>
    </MotionCard>
  );
}

function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user'));
  const [totalStudents, setTotalStudents] = useState(0);
  const [genderBatchCount, setGenderBatchCount] = useState({ data: [], grandTotal: {} });
  const [rcFilledCount, setRCFilledCount] = useState(0);
  const [rcCount, setRCCount] = useState([]);
  const [cityWithHighest, setCityWithHighest] = useState({ homeTown: 'None', count: 0 });
  const [cityCount, setCityCount] = useState([]);
  const [inOutCount, setInOutCount] = useState([]);
  const [inOutBatchCount, setInOutBatchCount] = useState({ data: [], grandTotal: {} });

  const genderModal = useDisclosure();
  const rcModal = useDisclosure();
  const cityModal = useDisclosure();
  const inOutModal = useDisclosure();
  const genderGraphModal = useDisclosure();
  const cityGraphModal = useDisclosure();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role === 'Student') {
      navigate('/award-form', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const socket = io("https://flameawards.in:8082");
    socket.on("connect", () => {
      console.log("Connected to Socket.IO server:", socket.id);
      socket.emit("requestData");
    });
    socket.on("updateData", (data) => {
      console.log("Received real-time data:", data);
      setTotalStudents(data.totalStudentCount.total);
      setGenderBatchCount(data.genderBatchCount);
      setRCFilledCount(data.rcFilledCount.total);
      setRCCount(data.rcCount);
      setCityWithHighest(data.cityWithHighestCount);
      setCityCount(data.cityCount);
      setInOutCount(data.inOutCount);
      setInOutBatchCount(data.inOutBatchCount);
    });
    socket.on("disconnect", () => {
      console.log("Disconnected from Socket.IO server");
    });
    return () => socket.disconnect();
  }, []);

  const COLORS = {
    primary: '#2563eb',
    secondary: '#10b981',
    accent: '#6366f1',
    warning: '#f97316',
    lightBg: '#f9fafb',
    textPrimary: '#111827',
    textSecondary: '#6b7280',
    white: '#ffffff',
    border: '#e5e7eb',
  };

  const textColor = useColorModeValue(COLORS.textPrimary, 'white');
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue(COLORS.border, 'gray.600');
  const lightBg = useColorModeValue(COLORS.lightBg, 'gray.700');

  const MotionTr = motion(Tr);

  const renderSmallTable = (data, columns, maxRows = 4, headerColor, tableTextColor) => (
    <Box overflowX="auto">
      <ChakraTable size="sm" width="100%">
        <Thead>
          <Tr>
            {columns.map((col, index) => (
              <Th
                key={index}
                width={`${100 / columns.length}%`}
                color={COLORS.white}
                bg={headerColor}
                textAlign="center"
                whiteSpace="nowrap"
                px={2}
              >
                {col}
              </Th>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {data.slice(0, maxRows).map((row, rowIndex) => (
            <MotionTr
              key={rowIndex}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              {Object.values(row).map((cell, cellIndex) => (
                <Td key={cellIndex} textAlign="center" whiteSpace="nowrap" color={tableTextColor}>{cell}</Td>
              ))}
            </MotionTr>
          ))}
        </Tbody>
      </ChakraTable>
    </Box>
  );

  const renderFullTable = (data, columns, grandTotal = null, headerColor, tableTextColor) => (
    <ChakraTable>
      <Thead position="sticky" top={0} bg={cardBg} zIndex={1}>
        <Tr>
          {columns.map((col, index) => (
            <Th
              key={index}
              width={`${100 / columns.length}%`}
              color={COLORS.white}
              bg={headerColor}
              textAlign="center"
              whiteSpace="nowrap"
              px={2}
            >
              {col}
            </Th>
          ))}
        </Tr>
      </Thead>
      <Tbody>
        {data.map((row, rowIndex) => (
          <MotionTr
            key={rowIndex}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {Object.values(row).map((cell, cellIndex) => (
              <Td key={cellIndex} textAlign="center" whiteSpace="nowrap" color={tableTextColor}>{cell}</Td>
            ))}
          </MotionTr>
        ))}
        {grandTotal && (
          <Tr bg={lightBg}>
            <Td textAlign="center" color={tableTextColor}><strong>Grand Total</strong></Td>
            {Object.values(grandTotal).map((total, index) => (
              <Td key={index} textAlign="center" color={tableTextColor}><strong>{total}</strong></Td>
            ))}
          </Tr>
        )}
      </Tbody>
    </ChakraTable>
  );

  const chartOptions = {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      legend: { position: 'top', labels: { color: textColor } },
      title: { display: false },
    },
    scales: {
      x: {
        ticks: {
          color: textColor,
          maxRotation: 45,
          minRotation: 45,
          font: { size: 12 },
          autoSkip: false
        },
        title: {
          display: true,
          text: 'Batch',
          color: textColor,
        },
      },
      y: {
        beginAtZero: true,
        ticks: { color: textColor, stepSize: 1 },
        title: {
          display: true,
          text: 'Student Count',
          color: textColor,
        },
      },
    },
  };

  const cityChartOptions = {
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      x: {
        ...chartOptions.scales.x,
        title: {
          display: true,
          text: 'HomeTown',
          color: textColor,
        },
      },
    },
  };

  const stackedChartOptions = {
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      x: {
        ...chartOptions.scales.x,
        stacked: true,
        title: {
          display: true,
          text: 'Batch',
          color: textColor,
        },
      },
      y: {
        ...chartOptions.scales.y,
        stacked: true
      },
    },
  };

  const genderChartData = {
    labels: genderBatchCount.data.map((item) => item.batch),
    datasets: [
      {
        label: 'Female',
        data: genderBatchCount.data.map((item) => item.female),
        backgroundColor: 'rgba(236, 72, 153, 0.6)',
      },
      {
        label: 'Male',
        data: genderBatchCount.data.map((item) => item.male),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
      },
    ],
  };

  const cityChartData = {
    labels: cityCount.map((item) => item.homeTown),
    datasets: [
      {
        label: 'Student Count',
        data: cityCount.map((item) => item.count),
        backgroundColor: 'rgba(16, 185, 129, 0.6)',
      },
    ],
  };

  const inOutChartData = {
    labels: inOutBatchCount.data.map((item) => item.batch),
    datasets: [
      {
        label: 'OUT',
        data: inOutBatchCount.data.map((item) => item.out),
        backgroundColor: 'rgba(239, 68, 68, 0.6)',
      },
      {
        label: 'IN',
        data: inOutBatchCount.data.map((item) => item.in),
        backgroundColor: 'rgba(34, 197, 94, 0.6)',
      },
    ],
  };

  const top5GenderBatches = [...genderBatchCount.data].sort((a, b) => b.total - a.total).slice(0, 5);
  const top5GenderChartData = {
    labels: top5GenderBatches.map((item) => item.batch),
    datasets: [
      {
        label: 'Female',
        data: top5GenderBatches.map((item) => item.female),
        backgroundColor: 'rgba(236, 72, 153, 0.6)',
      },
      {
        label: 'Male',
        data: top5GenderBatches.map((item) => item.male),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
      },
    ],
  };

  const top5Cities = [...cityCount].sort((a, b) => b.count - a.count).slice(0, 5);
  const top5CityChartData = {
    labels: top5Cities.map((item) => item.homeTown),
    datasets: [
      {
        label: 'Student Count',
        data: top5Cities.map((item) => item.count),
        backgroundColor: 'rgba(16, 185, 129, 0.6)',
      },
    ],
  };

  return (
    <>
      <Box p={8} pb={20}> {/* Added padding-bottom to avoid overlap with fixed icon */}
        <PageHeader
          title={`Welcome back, ${user?.username || 'Admin'}`}
          description="Here's an overview of the student tracking system"
        />
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={6}>
          <StatCard
            title="Total Students"
            stat={totalStudents}
            icon={UserGroupIcon}
            color={COLORS.primary}
          />
          <StatCard
            title="Students with RC"
            stat={rcFilledCount}
            icon={BuildingOfficeIcon}
            color={COLORS.accent}
          />
          <StatCard
            title={`Leading City (${cityWithHighest.homeTown})`}
            stat={cityWithHighest.count}
            icon={MapPinIcon}
            color={COLORS.secondary}
          />
          <StatCard
            title="Students Present"
            stat={inOutCount.find((item) => item.inOut === 'IN')?.count || 0}
            icon={CheckCircleIcon}
            color={COLORS.warning}
          />
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
          <MotionCard
            bg={cardBg}
            border="1px solid"
            borderColor={cardBorder}
            whileHover={{ y: -5 }}
            transition={{ duration: 0.2 }}
          >
            <CardHeader position="relative" pb={0}>
              <HStack>
                <Icon as={UserGroupIcon} boxSize={8} color={COLORS.primary} />
                <VStack align="start">
                  <Text fontSize="lg" fontWeight="bold" color={textColor}>Gender-wise Count</Text>
                  <Text fontSize="2xl" fontWeight="bold" color={COLORS.primary}>{totalStudents}</Text>
                </VStack>
              </HStack>
              <IconButton
                aria-label="View more"
                icon={<Icon as={ArrowsPointingOutIcon} />}
                position="absolute"
                top={2}
                right={2}
                onClick={genderModal.onOpen}
              />
            </CardHeader>
            <CardBody>
              {renderSmallTable(
                genderBatchCount.data.map(({ batch, female, male, total }) => ({ batch, female, male, total })),
                ['Batch', 'Female', 'Male', 'Total'],
                4,
                COLORS.primary,
                textColor
              )}
            </CardBody>
          </MotionCard>

          <MotionCard
            bg={cardBg}
            border="1px solid"
            borderColor={cardBorder}
            whileHover={{ y: -5 }}
            transition={{ duration: 0.2 }}
          >
            <CardHeader position="relative" pb={0}>
              <HStack>
                <Icon as={BuildingOfficeIcon} boxSize={8} color={COLORS.accent} />
                <VStack align="start">
                  <Text fontSize="lg" fontWeight="bold" color={textColor}>RC-wise Count</Text>
                  <Text fontSize="2xl" fontWeight="bold" color={COLORS.accent}>{rcFilledCount}</Text>
                </VStack>
              </HStack>
              <IconButton
                aria-label="View more"
                icon={<Icon as={ArrowsPointingOutIcon} />}
                position="absolute"
                top={2}
                right={2}
                onClick={rcModal.onOpen}
              />
            </CardHeader>
            <CardBody>
              {renderSmallTable(
                rcCount.map(({ rcName, count }) => ({ rcName, count })),
                ['RC Name', 'Student Count'],
                4,
                COLORS.accent,
                textColor
              )}
            </CardBody>
          </MotionCard>

          <MotionCard
            bg={cardBg}
            border="1px solid"
            borderColor={cardBorder}
            whileHover={{ y: -5 }}
            transition={{ duration: 0.2 }}
          >
            <CardHeader position="relative" pb={0}>
              <HStack>
                <Icon as={MapPinIcon} boxSize={8} color={COLORS.secondary} />
                <VStack align="start">
                  <Text fontSize="lg" fontWeight="bold" color={textColor}>HomeTown-wise Count</Text>
                  <Text fontSize="2xl" fontWeight="bold" color={COLORS.secondary}>{cityWithHighest.count}</Text>
                </VStack>
              </HStack>
              <IconButton
                aria-label="View more"
                icon={<Icon as={ArrowsPointingOutIcon} />}
                position="absolute"
                top={2}
                right={2}
                onClick={cityModal.onOpen}
              />
            </CardHeader>
            <CardBody>
              {renderSmallTable(
                cityCount.map(({ homeTown, count }) => ({ homeTown, count })),
                ['HomeTown', 'Student Count'],
                4,
                COLORS.secondary,
                textColor
              )}
            </CardBody>
          </MotionCard>

          <MotionCard
            bg={cardBg}
            border="1px solid"
            borderColor={cardBorder}
            whileHover={{ y: -5 }}
            transition={{ duration: 0.2 }}
          >
            <CardHeader position="relative" pb={0}>
              <HStack>
                <Icon as={CheckCircleIcon} boxSize={8} color={COLORS.warning} />
                <VStack align="start">
                  <Text fontSize="lg" fontWeight="bold" color={textColor}>IN/OUT Count</Text>
                  <Text fontSize="2xl" fontWeight="bold" color={COLORS.warning}>
                    {inOutCount.find((item) => item.inOut === 'IN')?.count || 0}
                  </Text>
                </VStack>
              </HStack>
              <IconButton
                aria-label="View more"
                icon={<Icon as={ArrowsPointingOutIcon} />}
                position="absolute"
                top={2}
                right={2}
                onClick={inOutModal.onOpen}
              />
            </CardHeader>
            <CardBody>
              {renderSmallTable(
                inOutBatchCount.data.map(({ batch, in: inCount, out, total }) => ({ batch, in: inCount, out, total })),
                ['Batch', 'IN', 'OUT', 'Total'],
                4,
                COLORS.warning,
                textColor
              )}
            </CardBody>
          </MotionCard>
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mt={6}>
          <MotionCard
            bg={cardBg}
            border="1px solid"
            borderColor={cardBorder}
            whileHover={{ y: -5 }}
            transition={{ duration: 0.2 }}
          >
            <CardHeader position="relative">
              <Text fontSize="lg" fontWeight="bold" color={textColor}>Gender Distribution by Batch (Top 5)</Text>
              <IconButton
                aria-label="View full graph"
                icon={<Icon as={ArrowsPointingOutIcon} />}
                position="absolute"
                top={2}
                right={2}
                onClick={genderGraphModal.onOpen}
              />
            </CardHeader>
            <CardBody>
              <Box height="300px">
                <Bar data={top5GenderChartData} options={chartOptions} />
              </Box>
            </CardBody>
          </MotionCard>

          <MotionCard
            bg={cardBg}
            border="1px solid"
            borderColor={cardBorder}
            whileHover={{ y: -5 }}
            transition={{ duration: 0.2 }}
          >
            <CardHeader position="relative">
              <Text fontSize="lg" fontWeight="bold" color={textColor}>Students by HomeTown (Top 5)</Text>
              <IconButton
                aria-label="View full graph"
                icon={<Icon as={ArrowsPointingOutIcon} />}
                position="absolute"
                top={2}
                right={2}
                onClick={cityGraphModal.onOpen}
              />
            </CardHeader>
            <CardBody>
              <Box height="300px">
                <Bar data={top5CityChartData} options={cityChartOptions} />
              </Box>
            </CardBody>
          </MotionCard>
        </SimpleGrid>

        <SimpleGrid columns={1} spacing={6} mt={6}>
          <MotionCard
            bg={cardBg}
            border="1px solid"
            borderColor={cardBorder}
            whileHover={{ y: -5 }}
            transition={{ duration: 0.2 }}
          >
            <CardHeader>
              <Text fontSize="lg" fontWeight="bold" color={textColor}>IN/OUT Distribution by Batch (Stacked)</Text>
            </CardHeader>
            <CardBody>
              <Box height="300px">
                <Bar data={inOutChartData} options={stackedChartOptions} />
              </Box>
            </CardBody>
          </MotionCard>
        </SimpleGrid>

        <Modal isOpen={genderModal.isOpen} onClose={genderModal.onClose} size="xl">
          <ModalOverlay />
          <ModalContent maxHeight="80vh" overflowY="auto" bg={cardBg}>
            <ModalHeader color={COLORS.primary}>Gender-wise Student Count</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {renderFullTable(
                genderBatchCount.data.map(({ batch, female, male, total }) => ({ batch, female, male, total })),
                ['Batch', 'Female', 'Male', 'Total'],
                genderBatchCount.grandTotal,
                COLORS.primary,
                textColor
              )}
            </ModalBody>
            <ModalFooter>
              <Button bg={COLORS.primary} color={COLORS.white} onClick={genderModal.onClose}>Close</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal isOpen={rcModal.isOpen} onClose={rcModal.onClose} size="xl">
          <ModalOverlay />
          <ModalContent maxHeight="80vh" overflowY="auto" bg={cardBg}>
            <ModalHeader color={COLORS.accent}>RC-wise Student Count</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {renderFullTable(
                rcCount.map(({ rcName, count }) => ({ rcName, count })),
                ['RC Name', 'Student Count'],
                null,
                COLORS.accent,
                textColor
              )}
            </ModalBody>
            <ModalFooter>
              <Button bg={COLORS.accent} color={COLORS.white} onClick={rcModal.onClose}>Close</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal isOpen={cityModal.isOpen} onClose={cityModal.onClose} size="xl">
          <ModalOverlay />
          <ModalContent maxHeight="80vh" overflowY="auto" bg={cardBg}>
            <ModalHeader color={COLORS.secondary}>HomeTown-wise Student Count</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {renderFullTable(
                cityCount.map(({ homeTown, count }) => ({ homeTown, count })),
                ['HomeTown', 'Student Count'],
                null,
                COLORS.secondary,
                textColor
              )}
            </ModalBody>
            <ModalFooter>
              <Button bg={COLORS.secondary} color={COLORS.white} onClick={cityModal.onClose}>Close</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal isOpen={inOutModal.isOpen} onClose={inOutModal.onClose} size="xl">
          <ModalOverlay />
          <ModalContent maxHeight="80vh" overflowY="auto" bg={cardBg}>
            <ModalHeader color={COLORS.warning}>Batch-wise IN/OUT Count</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {renderFullTable(
                inOutBatchCount.data.map((item) => ({
                  batch: item.batch,
                  in: item.in || 0,
                  out: item.out || 0,
                  noPunch: item.noPunch || 0,
                  total: item.total || 0,
                })),
                ['Batch', 'IN', 'OUT', 'NO PUNCH', 'Total'],
                inOutBatchCount.grandTotal,
                COLORS.warning,
                textColor
              )}
            </ModalBody>
            <ModalFooter>
              <Button bg={COLORS.warning} color={COLORS.white} onClick={inOutModal.onClose}>Close</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal isOpen={genderGraphModal.isOpen} onClose={genderGraphModal.onClose} size="xl">
          <ModalOverlay />
          <ModalContent maxHeight="80vh" overflowY="auto" bg={cardBg}>
            <ModalHeader color={COLORS.primary}>Full Gender Distribution by Batch</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Box height="500px">
                <Bar data={genderChartData} options={chartOptions} />
              </Box>
            </ModalBody>
            <ModalFooter>
              <Button bg={COLORS.primary} color={COLORS.white} onClick={genderGraphModal.onClose}>Close</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal isOpen={cityGraphModal.isOpen} onClose={cityGraphModal.onClose} size="xl">
          <ModalOverlay />
          <ModalContent maxHeight="80vh" overflowY="auto" bg={cardBg}>
            <ModalHeader color={COLORS.secondary}>Full Students by HomeTown</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Box height="500px">
                <Bar
                  data={{
                    labels: cityCount.filter((item) => item.count > 20).map((item) => item.homeTown),
                    datasets: [
                      {
                        label: 'Student Count',
                        data: cityCount.filter((item) => item.count > 20).map((item) => item.count),
                        backgroundColor: 'rgba(16, 185, 129, 0.6)',
                      },
                    ],
                  }}
                  options={cityChartOptions}
                />
              </Box>
              <Text fontSize="sm" color={useColorModeValue(COLORS.textSecondary, 'gray.400')} mt={2}>
                Note: Cities with student count values less than 20 are not shown on this graph.
              </Text>
            </ModalBody>
            <ModalFooter>
              <Button bg={COLORS.secondary} color={COLORS.white} onClick={cityGraphModal.onClose}>Close</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Box>
    </>
  );
}

export default Dashboard;