// src/pages/NominationView.jsx
import { useState, useEffect, useCallback } from 'react'
import {
  Box, Button, Text, VStack, HStack, SimpleGrid, Card, CardBody,
  Badge, Avatar, Divider, Spinner, Center, useToast, useColorModeValue,
  Flex, Icon, Stat, StatLabel, StatNumber, StatHelpText, Tooltip,
  Alert, AlertIcon, AlertDescription,
} from '@chakra-ui/react'
import {
  TrophyIcon, SparklesIcon, ArrowPathIcon, UserGroupIcon,
} from '@heroicons/react/24/outline'
import axios from 'axios'

const API = axios.create({ withCredentials: true })

const GRADIENT = 'linear(to-br, #1e3a8a, #2563eb)'

const AWARD_CONFIG = {
  'Sports Person Award': {
    color: 'blue',
    gradient: 'linear(to-br, #1e40af, #3b82f6)',
    icon: '🏅',
    scoreLabel: 'Sports Verified Score',
    scoreField: 'sports_verified_score',
  },
  'Co-curricular Person Award': {
    color: 'pink',
    gradient: 'linear(to-br, #9d174d, #ec4899)',
    icon: '🎭',
    scoreLabel: 'Cultural Verified Score',
    scoreField: 'cultural_verified_score',
  },
  'Trailblazer Award': {
    color: 'orange',
    gradient: 'linear(to-br, #92400e, #f59e0b)',
    icon: '🔥',
    scoreLabel: 'Total Score',
    scoreField: null, // computed
  },
}

function computeTotal(nominee) {
  const vals = [
    parseFloat(nominee.sports_verified_score),
    parseFloat(nominee.cultural_verified_score),
    parseFloat(nominee.academic_verified_score),
  ].filter(n => !isNaN(n))
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0).toFixed(2) : '—'
}

function WinnerCard({ nominee, config }) {
  const cardBg     = useColorModeValue('white', 'gray.800')
  const subColor   = useColorModeValue('gray.500', 'gray.400')
  const borderColor= useColorModeValue('gray.200', 'gray.600')
  const score      = config.scoreField ? (nominee[config.scoreField] ?? '—') : computeTotal(nominee)

  return (
    <Card
      bg={cardBg}
      borderRadius="2xl"
      boxShadow="xl"
      border="1px solid"
      borderColor={borderColor}
      overflow="hidden"
      transition="transform 0.2s, box-shadow 0.2s"
      _hover={{ transform: 'translateY(-4px)', boxShadow: '2xl' }}
    >
      {/* Gradient strip */}
      <Box bgGradient={config.gradient} h="6px" />
      <CardBody p={5}>
        <VStack spacing={3} align="stretch">
          <HStack spacing={3}>
            <Avatar
              name={nominee.name}
              src={`/api/photos/${nominee.student_id}`}
              size="md"
              border="3px solid"
              borderColor={`${config.color}.400`}
              boxShadow="md"
            />
            <VStack align="start" spacing={0} flex="1">
              <Text fontWeight="700" fontSize="14px" noOfLines={1}>{nominee.name}</Text>
              <Text fontSize="11px" color="blue.500" fontFamily="mono">{nominee.student_id}</Text>
              <Text fontSize="10px" color={subColor} noOfLines={1}>{nominee.email}</Text>
            </VStack>
          </HStack>

          <Divider />

          <SimpleGrid columns={2} spacing={2}>
            <Box>
              <Text fontSize="9px" fontWeight="700" textTransform="uppercase" letterSpacing="wider" color={subColor}>Gender</Text>
              <Text fontSize="12px" fontWeight="600">{nominee.gender || '—'}</Text>
            </Box>
            <Box>
              <Text fontSize="9px" fontWeight="700" textTransform="uppercase" letterSpacing="wider" color={subColor}>Batch</Text>
              <Text fontSize="12px" fontWeight="600">{nominee.batch || '—'}</Text>
            </Box>
          </SimpleGrid>

          <Box
            bg={useColorModeValue(`${config.color}.50`, `${config.color}.900`)}
            borderRadius="xl"
            p={3}
            textAlign="center"
          >
            <Text fontSize="9px" fontWeight="700" textTransform="uppercase" letterSpacing="wider"
              color={`${config.color}.600`}>{config.scoreLabel}</Text>
            <Text fontSize="24px" fontWeight="black" color={`${config.color}.600`} lineHeight="1.1">{score}</Text>
          </Box>
        </VStack>
      </CardBody>
    </Card>
  )
}

function AwardSection({ title, nominees, config }) {
  const headingColor = useColorModeValue('gray.800', 'white')
  const subColor     = useColorModeValue('gray.500', 'gray.400')

  if (!nominees || nominees.length === 0) {
    return (
      <Box>
        <HStack mb={4}>
          <Text fontSize="lg">{config.icon}</Text>
          <Text fontWeight="700" fontSize="lg" color={headingColor}>{title}</Text>
          <Badge colorScheme={config.color} borderRadius="full" px={2}>0 Nominees</Badge>
        </HStack>
        <Alert status="info" borderRadius="xl" fontSize="sm">
          <AlertIcon />
          <AlertDescription>No nominees yet. Click Generate Nominations to run the selection.</AlertDescription>
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      <HStack mb={4}>
        <Text fontSize="lg">{config.icon}</Text>
        <Text fontWeight="700" fontSize="lg" color={headingColor}>{title}</Text>
        <Badge colorScheme={config.color} borderRadius="full" px={2}>{nominees.length} {nominees.length === 1 ? 'Nominee' : 'Nominees'}</Badge>
      </HStack>
      <SimpleGrid columns={{ base: 1, md: nominees.length === 1 ? 1 : 2, lg: nominees.length === 1 ? 1 : 2 }}
        spacing={5} maxW={nominees.length === 1 ? '400px' : 'full'}>
        {nominees.map(n => (
          <WinnerCard key={n.id} nominee={n} config={config} />
        ))}
      </SimpleGrid>
    </Box>
  )
}

export default function NominationView() {
  const toast      = useToast()
  const bgColor    = useColorModeValue('gray.50', 'gray.900')
  const cardBg     = useColorModeValue('white', 'gray.800')
  const subColor   = useColorModeValue('gray.500', 'gray.400')
  const borderColor= useColorModeValue('gray.200', 'gray.600')

  const [nominees,    setNominees]    = useState([])
  const [isLoading,   setIsLoading]   = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await API.get('/api/nominations')
      setNominees(res.data?.data || [])
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.message || err.message, status: 'error', duration: 4000 })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const res = await API.post('/api/nominations/generate')
      setNominees(res.data?.nominees || [])
      toast({ title: `Generated ${res.data?.count || 0} nominees`, status: 'success', duration: 3000 })
    } catch (err) {
      toast({ title: 'Generation failed', description: err.response?.data?.message || err.message, status: 'error', duration: 4000 })
    } finally {
      setIsGenerating(false)
    }
  }

  // Group by award_name
  const grouped = {}
  for (const n of nominees) {
    const k = n.award_name || 'Unknown'
    if (!grouped[k]) grouped[k] = []
    grouped[k].push(n)
  }

  const awardOrder = ['Sports Person Award', 'Co-curricular Person Award', 'Trailblazer Award']

  return (
    <Box p={[3, 5, 8]} pt={[1, 2, 3]} bg={bgColor} minH="100vh">
      {/* Page Header */}
      <Card bg={cardBg} borderRadius="2xl" boxShadow="sm" border="1px solid" borderColor={borderColor} mb={6}>
        <CardBody p={6}>
          <Flex align="center" justify="space-between" flexWrap="wrap" gap={4}>
            <HStack spacing={4}>
              <Box
                w="48px" h="48px" borderRadius="xl"
                bgGradient={GRADIENT}
                display="flex" alignItems="center" justifyContent="center"
                boxShadow="lg"
              >
                <Icon as={TrophyIcon} color="white" w={6} h={6} />
              </Box>
              <VStack align="start" spacing={0}>
                <Text fontSize="xl" fontWeight="black" letterSpacing="-0.02em">Award Nominations</Text>
                <Text fontSize="sm" color={subColor}>Top performers selected per verified score</Text>
              </VStack>
            </HStack>

            <HStack spacing={3}>
              <Tooltip label="Reload current nominations" hasArrow>
                <Button size="sm" variant="outline" leftIcon={<Icon as={ArrowPathIcon} w={4} h={4} />}
                  onClick={load} isLoading={isLoading} borderRadius="xl">
                  Refresh
                </Button>
              </Tooltip>
              <Tooltip label="Recalculate — overwrites existing nominations" hasArrow>
                <Button
                  size="sm"
                  colorScheme="orange"
                  leftIcon={<Icon as={SparklesIcon} w={4} h={4} />}
                  onClick={handleGenerate}
                  isLoading={isGenerating}
                  loadingText="Generating…"
                  borderRadius="xl"
                  boxShadow="md"
                  _hover={{ transform: 'translateY(-1px)', boxShadow: 'lg' }}
                  transition="all 0.15s"
                >
                  Generate Nominations
                </Button>
              </Tooltip>
            </HStack>
          </Flex>

          {/* Stats row */}
          {nominees.length > 0 && (
            <>
              <Divider my={4} />
              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                <Stat>
                  <StatLabel fontSize="10px" textTransform="uppercase" letterSpacing="wider" color={subColor}>Total Nominees</StatLabel>
                  <StatNumber fontSize="2xl">{nominees.length}</StatNumber>
                </Stat>
                {awardOrder.map(award => (
                  <Stat key={award}>
                    <StatLabel fontSize="10px" textTransform="uppercase" letterSpacing="wider" color={subColor}>
                      {AWARD_CONFIG[award]?.icon} {award.replace(' Award', '')}
                    </StatLabel>
                    <StatNumber fontSize="2xl">{(grouped[award] || []).length}</StatNumber>
                  </Stat>
                ))}
              </SimpleGrid>
            </>
          )}
        </CardBody>
      </Card>

      {/* Award sections */}
      {isLoading ? (
        <Center py={16}>
          <VStack spacing={4}>
            <Spinner size="xl" thickness="4px" color="blue.500" />
            <Text color={subColor}>Loading nominations…</Text>
          </VStack>
        </Center>
      ) : (
        <VStack spacing={10} align="stretch">
          {awardOrder.map(award => (
            <AwardSection
              key={award}
              title={award}
              nominees={grouped[award] || []}
              config={AWARD_CONFIG[award]}
            />
          ))}
        </VStack>
      )}
    </Box>
  )
}
