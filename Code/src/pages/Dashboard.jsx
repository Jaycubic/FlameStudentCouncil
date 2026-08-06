// src/pages/Dashboard.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { motion } from 'framer-motion';
import {
  Box, SimpleGrid, Card, CardBody, CardHeader,
  Text, HStack, VStack, Icon, useColorModeValue,
  IconButton, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalCloseButton, ModalBody, ModalFooter,
  Button, useDisclosure, Badge,
} from '@chakra-ui/react';
import {
  UserGroupIcon,
  ArrowsPointingOutIcon,
} from '@heroicons/react/24/outline';
import { FaVoteYea } from 'react-icons/fa';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend,
} from 'chart.js';
import PageHeader from '../components/layout/PageHeader';
import { dashboardService } from '../services/DashboardService';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const MotionCard = motion(Card);

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ title, stat, icon, gradient, badge }) {
  const bg = useColorModeValue('white', 'gray.800');
  const label = useColorModeValue('gray.500', 'gray.400');
  return (
    <MotionCard
      bg={bg}
      border="1px solid"
      borderColor={useColorModeValue('gray.100', 'gray.700')}
      borderRadius="2xl"
      whileHover={{ y: -6, boxShadow: '0 12px 32px rgba(0,0,0,0.12)' }}
      transition={{ duration: 0.2 }}
      overflow="hidden"
    >
      <Box h="4px" bgGradient={gradient} />
      <CardBody pt={4}>
        <HStack spacing={4} align="center">
          <Box
            p={3}
            borderRadius="xl"
            bgGradient={gradient}
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Icon as={icon} boxSize={6} color="white" />
          </Box>
          <Box flex={1}>
            <Text fontSize="xs" fontWeight="600" color={label} textTransform="uppercase" letterSpacing="wide">
              {title}
            </Text>
            <HStack align="baseline" spacing={2}>
              <Text fontSize="3xl" fontWeight="800" lineHeight="1.1">
                {stat ?? '—'}
              </Text>
              {badge && (
                <Badge colorScheme="green" fontSize="xs" borderRadius="full">
                  {badge}
                </Badge>
              )}
            </HStack>
          </Box>
        </HStack>
      </CardBody>
    </MotionCard>
  );
}

// ─── Chart Card ───────────────────────────────────────────────────────────────
function ChartCard({ title, children, onExpand }) {
  const bg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.100', 'gray.700');
  const text = useColorModeValue('gray.800', 'white');
  return (
    <MotionCard
      bg={bg}
      border="1px solid"
      borderColor={border}
      borderRadius="2xl"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <CardHeader pb={0} position="relative">
        <Text fontSize="md" fontWeight="700" color={text}>{title}</Text>
        {onExpand && (
          <IconButton
            aria-label="Expand chart"
            icon={<Icon as={ArrowsPointingOutIcon} />}
            size="sm"
            variant="ghost"
            position="absolute"
            top={3}
            right={3}
            onClick={onExpand}
          />
        )}
      </CardHeader>
      <CardBody>{children}</CardBody>
    </MotionCard>
  );
}

// Color palette for dynamic positions
const POSITION_COLORS = [
  'rgba(59, 130, 246, 0.75)',   // blue
  'rgba(236, 72, 153, 0.75)',   // pink
  'rgba(245, 158, 11, 0.75)',   // amber
  'rgba(34, 197, 94, 0.75)',    // green
  'rgba(168, 85, 247, 0.75)',   // purple
  'rgba(244, 63, 94, 0.75)',    // rose
  'rgba(14, 165, 233, 0.75)',   // sky
  'rgba(251, 146, 60, 0.75)',   // orange
];

const POSITION_GRADIENTS = [
  'linear(to-br, blue.400, blue.600)',
  'linear(to-br, pink.400, pink.600)',
  'linear(to-br, orange.400, orange.600)',
  'linear(to-br, green.400, green.600)',
  'linear(to-br, purple.400, purple.600)',
  'linear(to-br, red.400, red.600)',
  'linear(to-br, cyan.400, cyan.600)',
  'linear(to-br, yellow.400, yellow.600)',
];

// ─── Main Dashboard ───────────────────────────────────────────────────────────
function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user'));
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const [stats, setStats] = useState({
    totalApplicants: 0,
    totalSubmissions: 0,
    positionCounts: {},
    genderByPosition: {},
    genderTotals: { male: 0, female: 0, other: 0 },
    batchByPosition: [],
    positions: [],
  });

  const genderModal = useDisclosure();
  const batchModal = useDisclosure();

  const textColor = useColorModeValue('gray.800', 'white');
  const cardBg = useColorModeValue('white', 'gray.800');

  // Redirect students
  useEffect(() => {
    if (user?.role === 'Student') navigate('/award-form', { replace: true });
  }, [user, navigate]);

  // Initial HTTP fetch
  useEffect(() => {
    dashboardService.getStats()
      .then(data => { if (data) setStats(data); })
      .catch(err => console.error('[Dashboard] Initial fetch error:', err));
  }, []);

  // Socket.IO — live updates
  useEffect(() => {
    const socket = io('https://flamestudentcouncil.in');
    socketRef.current = socket;
    socket.on('connect', () => { socket.emit('requestDashboard'); });
    socket.on('dashboardUpdate', (data) => { if (data) setStats(data); });
    return () => socket.disconnect();
  }, []);

  // ── Chart options ────────────────────────────────────────────────────────
  const baseOptions = {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      legend: { position: 'top', labels: { color: textColor, font: { size: 12 } } },
      title: { display: false },
    },
    scales: {
      x: { ticks: { color: textColor, font: { size: 11 } } },
      y: { beginAtZero: true, ticks: { color: textColor, stepSize: 1 } },
    },
  };

  // ── Gender distribution by position ─────────────────────────────────────
  const positionLabels = stats.positions || Object.keys(stats.positionCounts || {});
  const genderChartData = {
    labels: positionLabels,
    datasets: [
      {
        label: 'Male',
        data: positionLabels.map(pos => stats.genderByPosition?.[pos]?.male ?? 0),
        backgroundColor: 'rgba(59, 130, 246, 0.75)',
        borderRadius: 6,
      },
      {
        label: 'Female',
        data: positionLabels.map(pos => stats.genderByPosition?.[pos]?.female ?? 0),
        backgroundColor: 'rgba(236, 72, 153, 0.75)',
        borderRadius: 6,
      },
      {
        label: 'Other',
        data: positionLabels.map(pos => stats.genderByPosition?.[pos]?.other ?? 0),
        backgroundColor: 'rgba(168, 85, 247, 0.75)',
        borderRadius: 6,
      },
    ],
  };

  // ── Batch distribution by position ───────────────────────────────────────
  const batchChartData = {
    labels: (stats.batchByPosition || []).map(b => b.batch),
    datasets: positionLabels.map((pos, i) => ({
      label: pos,
      data: (stats.batchByPosition || []).map(b => b[pos] || 0),
      backgroundColor: POSITION_COLORS[i % POSITION_COLORS.length],
      borderRadius: 4,
    })),
  };

  // Build stat cards dynamically from positionCounts
  const positionEntries = Object.entries(stats.positionCounts || {}).sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      <Box p={8} pb={20}>
        <PageHeader
          title={`Welcome back, ${user?.username || 'Admin'}`}
          description="Student Council 2026 — live applicant overview"
        />

        {/* ── Stat Cards ── */}
        <SimpleGrid columns={{ base: 1, sm: 2, lg: Math.min(positionEntries.length + 1, 4) }} spacing={5} mb={8}>
          {positionEntries.map(([position, count], i) => (
            <StatCard
              key={position}
              title={`${position} Applicants`}
              stat={count}
              icon={FaVoteYea}
              gradient={POSITION_GRADIENTS[i % POSITION_GRADIENTS.length]}
            />
          ))}
          <StatCard
            title="Total Applicants"
            stat={stats.totalApplicants}
            icon={UserGroupIcon}
            gradient="linear(to-br, purple.500, purple.700)"
            badge="Unique"
          />
        </SimpleGrid>

        {/* ── Charts ── */}
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          <ChartCard
            title="Gender Distribution by Position"
            onExpand={genderModal.onOpen}
          >
            <Box height="300px">
              <Bar data={genderChartData} options={baseOptions} />
            </Box>
          </ChartCard>

          <ChartCard
            title="Batch Distribution by Position"
            onExpand={batchModal.onOpen}
          >
            <Box height="300px">
              <Bar data={batchChartData} options={baseOptions} />
            </Box>
          </ChartCard>
        </SimpleGrid>

        {/* ── Gender Modal ── */}
        <Modal isOpen={genderModal.isOpen} onClose={genderModal.onClose} size="xl">
          <ModalOverlay backdropFilter="blur(4px)" />
          <ModalContent bg={cardBg} borderRadius="2xl">
            <ModalHeader color={textColor}>Gender Distribution by Position</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Box height="450px">
                <Bar data={genderChartData} options={baseOptions} />
              </Box>
            </ModalBody>
            <ModalFooter>
              <Button onClick={genderModal.onClose} colorScheme="blue">Close</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* ── Batch Modal ── */}
        <Modal isOpen={batchModal.isOpen} onClose={batchModal.onClose} size="xl">
          <ModalOverlay backdropFilter="blur(4px)" />
          <ModalContent bg={cardBg} borderRadius="2xl">
            <ModalHeader color={textColor}>Batch Distribution by Position</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Box height="450px">
                <Bar data={batchChartData} options={baseOptions} />
              </Box>
            </ModalBody>
            <ModalFooter>
              <Button onClick={batchModal.onClose} colorScheme="purple">Close</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Box>
    </>
  );
}

export default Dashboard;