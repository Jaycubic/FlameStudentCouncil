// src/pages/NominationView.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box, Button, Text, VStack, HStack, Card, CardBody,
  Badge, Avatar, Divider, Spinner, Center, useToast, useColorModeValue,
  Flex, Icon, Stat, StatLabel, StatNumber, useDisclosure, Tooltip,
  Alert, AlertIcon, AlertDescription, AlertTitle,
  ModalCloseButton, Checkbox, Input, IconButton, SimpleGrid, Tabs, TabList, Tab,
} from '@chakra-ui/react'
import {
  TrophyIcon, SparklesIcon, EnvelopeIcon, PaperAirplaneIcon,
  CheckCircleIcon, ExclamationCircleIcon, XMarkIcon, TrashIcon,
  StarIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'

import { nominationService } from '../services/nominationService'

const GRADIENT = 'linear(to-br, #1e3a8a, #2563eb)'

// ─── Award config ─────────────────────────────────────────────────────────────
const AWARD_CONFIG = {
  'SportsPerson of The Year Award': {
    color: 'blue', gradient: 'linear(to-br, #1e40af, #3b82f6)',
    solidGradient: '#1e40af', icon: '🏅',
    scoreLabel: 'Sports Score', scoreField: 'sports_verified_score',
    nomineeCount: '5M + 5F', winnerLabel: '1 winner',
  },
  'Best in Co-curricular Activities': {
    color: 'pink', gradient: 'linear(to-br, #9d174d, #ec4899)',
    solidGradient: '#9d174d', icon: '🎭',
    scoreLabel: 'Cultural Score', scoreField: 'cultural_verified_score',
    nomineeCount: '5M + 5F', winnerLabel: '1 winner',
  },
  'Trailblazer Award': {
    color: 'orange', gradient: 'linear(to-br, #92400e, #f59e0b)',
    solidGradient: '#92400e', icon: '🔥',
    scoreLabel: 'Total Score', scoreField: null,
    nomineeCount: '3M + 3F', winnerLabel: '1 winner',
  },
}
const AWARD_ORDER = ['SportsPerson of The Year Award', 'Best in Co-curricular Activities', 'Trailblazer Award']

function computeTotal(n) {
  const vals = [
    parseFloat(n.sports_verified_score),
    parseFloat(n.cultural_verified_score),
    parseFloat(n.academic_verified_score),
  ].filter(v => !isNaN(v))
  return vals.length ? vals.reduce((a, b) => a + b, 0).toFixed(2) : '—'
}

const isValidEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

// ─── TagInput ─────────────────────────────────────────────────────────────────
function TagInput({ tags, setTags, placeholder, colorScheme = 'blue' }) {
  const [input, setInput] = useState('')
  const borderCol = useColorModeValue('gray.200', 'gray.600')
  const chipBg = useColorModeValue(`${colorScheme}.50`, `${colorScheme}.900`)
  const chipColor = useColorModeValue(`${colorScheme}.700`, `${colorScheme}.200`)
  const invalid = input.length > 3 && !isValidEmail(input)

  const addTag = val => {
    const email = val.trim().toLowerCase()
    if (!isValidEmail(email)) return
    if (!tags.includes(email)) setTags(prev => [...prev, email])
    setInput('')
  }
  const handleKeyDown = e => {
    if (['Enter', ',', 'Tab'].includes(e.key)) { e.preventDefault(); addTag(input) }
    if (e.key === 'Backspace' && !input && tags.length) setTags(prev => prev.slice(0, -1))
  }

  return (
    <Box
      border="1px solid" borderColor={invalid ? 'red.300' : borderCol}
      borderRadius="lg" p={1.5} minH="38px"
      display="flex" flexWrap="wrap" gap={1} alignItems="center"
      _focusWithin={{ borderColor: 'blue.400', boxShadow: '0 0 0 1px var(--chakra-colors-blue-400)' }}
    >
      {tags.map(tag => (
        <HStack key={tag} bg={chipBg} color={chipColor} borderRadius="full"
          px={2.5} py="2px" spacing={1.5} fontSize="11px" fontWeight="500" flexShrink={0}>
          <Text lineHeight="1.4">{tag}</Text>
          <Box as="button" onClick={() => setTags(prev => prev.filter(t => t !== tag))}
            _hover={{ color: 'red.500' }} lineHeight="1" display="flex" alignItems="center">
            <XMarkIcon style={{ width: 10, height: 10 }} />
          </Box>
        </HStack>
      ))}
      <Input
        variant="unstyled" value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown} onBlur={() => addTag(input)}
        placeholder={tags.length === 0 ? placeholder : ''}
        fontSize="12px" flex="1" minW="130px" px={1} h="auto"
      />
    </Box>
  )
}

// ─── ToolBtn ──────────────────────────────────────────────────────────────────
function ToolBtn({ label, onExec, title, btnStyle = {} }) {
  const hoverBg = useColorModeValue('gray.200', 'gray.600')
  return (
    <Tooltip label={title} hasArrow openDelay={500} fontSize="11px">
      <Button
        size="xs" variant="ghost" fontFamily="mono" fontSize="11px"
        px={1.5} minW="26px" h="24px" borderRadius="sm"
        onClick={onExec} _hover={{ bg: hoverBg }} style={btnStyle}
        onMouseDown={e => e.preventDefault()}
      >
        {label}
      </Button>
    </Tooltip>
  )
}

// ─── RichTextEditor ───────────────────────────────────────────────────────────
function RichTextEditor({ editorRef }) {
  const [isEmpty, setIsEmpty] = useState(true)
  const toolbarBg = useColorModeValue('gray.50', 'gray.750')
  const borderCol = useColorModeValue('gray.200', 'gray.600')
  const editorBg = useColorModeValue('white', 'gray.800')
  const phColor = useColorModeValue('gray.400', 'gray.500')
  const linkColor = useColorModeValue('blue.600', 'blue.300')

  const exec = (cmd, val = null) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, val)
  }
  const ToolSep = () => <Box w="1px" h="18px" bg={borderCol} mx={0.5} flexShrink={0} />

  return (
    <Box border="1px solid" borderColor={borderCol} borderRadius="xl"
      overflow="hidden" display="flex" flexDirection="column" h="full">
      <Box bg={toolbarBg} px={2} py={1.5} borderBottom="1px solid" borderColor={borderCol} flexShrink={0}>
        <HStack spacing={0.5} flexWrap="wrap" rowGap="4px">
          <ToolBtn label="B" onExec={() => exec('bold')} title="Bold" btnStyle={{ fontWeight: 900 }} />
          <ToolBtn label="I" onExec={() => exec('italic')} title="Italic" btnStyle={{ fontStyle: 'italic' }} />
          <ToolBtn label="U" onExec={() => exec('underline')} title="Underline" btnStyle={{ textDecoration: 'underline' }} />
          <ToolSep />
          <ToolBtn label="•" onExec={() => exec('insertUnorderedList')} title="Bullet List" />
          <ToolBtn label="1." onExec={() => exec('insertOrderedList')} title="Numbered List" />
          <ToolSep />
          <ToolBtn label="H1" onExec={() => exec('formatBlock', 'h2')} title="Heading" btnStyle={{ fontWeight: 800, fontSize: '10px' }} />
          <ToolBtn label="¶" onExec={() => exec('formatBlock', 'p')} title="Paragraph" btnStyle={{ fontSize: '13px' }} />
          <ToolSep />
          <ToolBtn label="↩" onExec={() => exec('removeFormat')} title="Clear Formatting" />
        </HStack>
      </Box>
      <Box position="relative" bg={editorBg} flex="1" overflow="hidden">
        {isEmpty && (
          <Text position="absolute" top={3} left={3} right={3} fontSize="13px"
            color={phColor} pointerEvents="none" userSelect="none" zIndex={0}
            whiteSpace="pre-line" lineHeight="1.75">
            {'Dear [Recipient],\n\nWe are pleased to inform you that you have been selected…'}
          </Text>
        )}
        <Box
          ref={editorRef} contentEditable suppressContentEditableWarning
          h="full" minH="220px" p={3} outline="none"
          fontSize="13.5px" lineHeight="1.75" overflowY="auto"
          onInput={e => {
            const v = e.target.innerHTML
            setIsEmpty(!v || v === '<br>' || v.trim() === '' || v === '<br/>')
          }}
          sx={{
            '& h2': { fontSize: '18px', fontWeight: '800', mt: '8px', mb: '4px' },
            '& ul, & ol': { pl: '22px' },
            '& p': { my: '2px' },
            '& a': { color: linkColor },
          }}
        />
      </Box>
    </Box>
  )
}

const TEMPLATES = {
  'SportsPerson of The Year Award': {
      subject: 'Congratulations! You’ve Won the Best in Sports Award',
      body: `Dear [Student's Name],<br><br>Congratulations! You have been awarded the Sportsperson of the Year Award for your exceptional performance and dedication in the field of sports. 🏆<br><br>Your hard work and perseverance have not gone unnoticed, and this award is a testament to your commitment to excellence.<br><br>You will be formally awarded at the Annual Student Awards Ceremony:<br><b>📍 Venue:</b> Shantiniketan Auditorium<br><b>⏰ Timing:</b> 4:30 PM<br><b>👔 Dress Code:</b> Formals<br><br>Please confirm your attendance at your earliest convenience.<br><br>Once again, congratulations! We look forward to celebrating with you.<br><br>Wishing you all the best!`
  },
  'Best in Co-curricular Activities': {
      subject: 'Congratulations! You’ve Been Awarded the Best in Co-Curricular Activities',
      body: `Dear [Student's Name],<br><br>We are thrilled to inform you that you have been selected as the recipient of this year’s Best in Co-Curricular Activities Award! 🎉<br><br>Your dedication, passion, and contributions to co-curricular activities have truly set you apart. This award recognizes your outstanding achievements and the impact you have made.<br><br>You will be formally awarded at the Annual Student Awards Ceremony:<br><b>📍 Venue:</b> Shantiniketan Auditorium<br><b>⏰ Timing:</b> 4:30 PM<br><b>👔 Dress Code:</b> Formals<br><br>Please confirm your attendance at your earliest convenience.<br><br>Congratulations once again! We are incredibly proud of you and look forward to celebrating this achievement with you.<br><br>Wishing you all the best!`
  },
  'Trailblazer Award': {
      subject: 'Congratulations! You Are a Trailblazers Award Winner',
      body: `Dear [Student's Name],<br><br>We are excited to announce that you have been selected as a Trailblazers Award winner! 🌟 This award celebrates your excellence across academics, sports, and cultural activities, making you a true all-rounder.<br><br>Your ability to balance multiple domains while excelling in each is truly commendable, and we are proud to recognize your achievements.<br><br>You will be formally awarded at the Annual Student Awards Ceremony:<br><b>📍 Venue:</b> Shantiniketan Auditorium<br><b>⏰ Timing:</b> 4:30 PM<br><b>👔 Dress Code:</b> Formals<br><br>Please confirm your attendance at your earliest convenience.<br><br>Congratulations once again! Keep inspiring those around you.<br><br>Wishing you all the best!`
  },
  'Not Nominated': {
      subject: 'Update on Your Application for the Annual Student Awards',
      body: `Dear [Student's Name],<br><br>Thank you for your application for the [Awards] that you have worked towards. We truly appreciate the time and effort you put into showcasing your achievements.<br><br>After careful consideration, we regret to inform you that your application has not been selected for this year’s award. This in no way diminishes your accomplishments, and we encourage you to continue pursuing excellence in your endeavors.<br><br>We hope to see you apply again in the future! If you would like any feedback on your application, feel free to reach out.<br><br>Wishing you all the best!`
  }
}

// ─── ComposeModal ─────────────────────────────────────────────────────────────
function ComposeModal({ isOpen, onClose, communicationGroups = {} }) {
  const toast = useToast()
  const editorRef = useRef(null)
  const modalBg = useColorModeValue('white', 'gray.800')
  const leftBg = useColorModeValue('gray.50', 'gray.900')
  const divColor = useColorModeValue('gray.200', 'gray.600')
  const subColor = useColorModeValue('gray.500', 'gray.400')
  const rowHover = useColorModeValue('gray.100', 'gray.700')
  const inputBorder = useColorModeValue('gray.200', 'gray.600')

  const TABS = ['SportsPerson of The Year Award', 'Best in Co-curricular Activities', 'Trailblazer Award', 'Not Nominated']

  const [activeTab, setActiveTab] = useState(TABS[0])
  const [selectedEmails, setSelectedEmails] = useState(new Set())
  const [extraRecipients, setExtraRecipients] = useState([])
  const [ccList, setCcList] = useState([])
  const [subject, setSubject] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setActiveTab(TABS[0])
      setExtraRecipients([])
      setCcList([])
      setSendResult(null)
      setIsSending(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return;
    const currentGroup = communicationGroups[activeTab] || [];
    setSelectedEmails(new Set(currentGroup.map(n => n.email)))
    setSubject(TEMPLATES[activeTab]?.subject || '')
    setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = TEMPLATES[activeTab]?.body || '' }, 60)
  }, [isOpen, activeTab, communicationGroups])

  const currentGroup = communicationGroups[activeTab] || [];
  const allSelected = currentGroup.length > 0 && selectedEmails.size === currentGroup.length
  const someSelected = selectedEmails.size > 0 && selectedEmails.size < currentGroup.length
  
  const toggleEmail = email => setSelectedEmails(prev => { const s = new Set(prev); s.has(email) ? s.delete(email) : s.add(email); return s })
  const toggleAll = checked => setSelectedEmails(checked ? new Set(currentGroup.map(n => n.email)) : new Set())

  const activeEmails = currentGroup.filter(n => selectedEmails.has(n.email)).map(n => n.email)
  const allEmails = [...new Set([...activeEmails, ...extraRecipients])]
  const totalCount = allEmails.length

  const handleSend = async () => {
    const body = editorRef.current?.innerHTML || ''
    if (!totalCount) { toast({ title: 'Select at least one recipient', status: 'warning', duration: 3000, isClosable: true }); return }
    if (!subject.trim()) { toast({ title: 'Subject is required', status: 'warning', duration: 3000, isClosable: true }); return }
    if (!body || body === '<br>' || body.trim() === '') {
      toast({ title: 'Email body cannot be empty', status: 'warning', duration: 3000, isClosable: true }); return
    }
    setIsSending(true)
    
    const selectedRecipients = currentGroup.filter(n => selectedEmails.has(n.email))
    const extraRecipientsObj = extraRecipients.filter(email => !selectedEmails.has(email)).map(email => ({ email, name: '', rejected_awards: '' }))
    const recipients = [...selectedRecipients, ...extraRecipientsObj]

    try {
      const result = await nominationService.sendNotifications({ recipients, cc: ccList, subject: subject.trim(), html: body })
      setSendResult(result)
    } catch (err) {
      toast({ title: 'Send failed', description: err.message, status: 'error', duration: 6000, isClosable: true })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside"
      closeOnOverlayClick={!isSending} isCentered>
      <ModalOverlay backdropFilter="blur(8px)" bg="blackAlpha.500" />
      <ModalContent borderRadius="2xl" overflow="hidden" maxH="90vh" m={4} bg={modalBg}
        boxShadow="0 32px 80px rgba(0,0,0,0.25)">
        <Box bgGradient={GRADIENT} px={6} py={4} flexShrink={0}>
          <ModalCloseButton color="white" top={3} right={4} isDisabled={isSending}
            _hover={{ bg: 'whiteAlpha.200' }} borderRadius="lg" />
          <HStack spacing={3}>
            <Box w="38px" h="38px" borderRadius="xl" bg="whiteAlpha.200"
              display="flex" alignItems="center" justifyContent="center">
              <Icon as={EnvelopeIcon} color="white" w={5} h={5} />
            </Box>
            <VStack align="start" spacing={0}>
              <Text color="white" fontWeight="800" fontSize="16px">Send Award Notification</Text>
              <Text color="whiteAlpha.700" fontSize="11px">Compose and send notifications to nominees</Text>
            </VStack>
          </HStack>
        </Box>

        {!sendResult && (
          <Box bg={leftBg} px={6} py={2} borderBottom="1px solid" borderColor={divColor}>
            <Tabs variant="soft-rounded" colorScheme="blue" size="sm" index={TABS.indexOf(activeTab)} onChange={idx => setActiveTab(TABS[idx])}>
              <TabList overflowX="auto" pb={1} sx={{ '&::-webkit-scrollbar': { display: 'none' }}}>
                {TABS.map(tab => (
                  <Tab key={tab} whiteSpace="nowrap" fontWeight="600">
                    {tab} <Badge ml={2} colorScheme={tab === 'Not Nominated' ? 'red' : 'blue'} borderRadius="full">{communicationGroups[tab]?.length || 0}</Badge>
                  </Tab>
                ))}
              </TabList>
            </Tabs>
          </Box>
        )}

        <ModalBody p={0} overflow="hidden">
          {sendResult ? (
            <Box p={8}>
              <VStack spacing={5} align="stretch">
                <Alert status={sendResult.failed === 0 ? 'success' : sendResult.sent === 0 ? 'error' : 'warning'}
                  borderRadius="2xl" p={5} variant="left-accent">
                  <AlertIcon boxSize={6} />
                  <Box>
                    <AlertTitle fontWeight="800" fontSize="15px">
                      {sendResult.failed === 0
                        ? `✅ All ${sendResult.sent} emails sent!`
                        : sendResult.sent === 0
                          ? `❌ All ${sendResult.failed} failed`
                          : `⚠️ ${sendResult.sent} sent · ${sendResult.failed} failed`}
                    </AlertTitle>
                    {sendResult.failed > 0 && (
                      <AlertDescription fontSize="12px" mt={1}>
                        Failed: {sendResult.details.failed.map(f => f.email).join(', ')}
                      </AlertDescription>
                    )}
                  </Box>
                </Alert>
              </VStack>
            </Box>
          ) : (
            <Flex h="calc(90vh - 148px)" overflow="hidden">
              <Box w="310px" flexShrink={0} bg={leftBg} borderRight="1px solid"
                borderColor={divColor} display="flex" flexDirection="column" overflow="hidden">
                <Box p={4} borderBottom="1px solid" borderColor={divColor} flexShrink={0}>
                  <Text fontSize="10px" fontWeight="700" textTransform="uppercase"
                    letterSpacing="wider" color={subColor} mb={2}>Recipients</Text>
                  <Checkbox isChecked={allSelected} isIndeterminate={someSelected}
                    onChange={e => toggleAll(e.target.checked)}
                    fontSize="13px" fontWeight="600" colorScheme="blue">
                    Select All
                    <Badge ml={2} colorScheme="blue" borderRadius="full" fontSize="9px" fontWeight="700">
                      {currentGroup.length}
                    </Badge>
                  </Checkbox>
                </Box>
                <Box flex="1" overflowY="auto" p={3}>
                  {currentGroup.length === 0 ? (
                    <Text fontSize="12px" color={subColor} textAlign="center" mt={4}>No recipients in this group.</Text>
                  ) : (
                    <VStack spacing={0.5} align="stretch">
                      {currentGroup.map((n, i) => (
                        <HStack key={n.email + '_' + i} p={1.5} borderRadius="lg" cursor="pointer" spacing={2}
                          bg={selectedEmails.has(n.email) ? `blue.50` : 'transparent'}
                          _hover={{ bg: rowHover }} onClick={() => toggleEmail(n.email)}>
                          <Checkbox isChecked={selectedEmails.has(n.email)} colorScheme="blue"
                            onClick={e => e.stopPropagation()} onChange={() => toggleEmail(n.email)} flexShrink={0} />
                          <VStack align="start" spacing={0} flex="1" minW={0}>
                            <HStack spacing={1}>
                              {n.is_top_pick && <Icon as={StarSolid} w={2.5} h={2.5} color={`blue.500`} />}
                              <Text fontSize="12px" fontWeight={n.is_top_pick ? '700' : '500'} noOfLines={1}>{n.name}</Text>
                            </HStack>
                            <Text fontSize="10px" color={subColor} noOfLines={1}>
                              {activeTab === 'Not Nominated' && n.rejected_awards ? `Rejected: ${n.rejected_awards}` : `${n.gender || ''} · ${n.batch || ''}`}
                            </Text>
                          </VStack>
                          {n.rank && <Badge colorScheme={n.is_top_pick ? 'blue' : 'gray'} fontSize="8px" borderRadius="full" flexShrink={0}>#{n.rank}</Badge>}
                        </HStack>
                      ))}
                    </VStack>
                  )}
                </Box>
                <Box p={3} borderTop="1px solid" borderColor={divColor} flexShrink={0}>
                  <Text fontSize="10px" fontWeight="700" textTransform="uppercase"
                    letterSpacing="wider" color={subColor} mb={1.5}>Additional Recipients</Text>
                  <TagInput tags={extraRecipients} setTags={setExtraRecipients}
                    placeholder="email@example.com + Enter" colorScheme="gray" />
                </Box>
              </Box>

              <Flex flex="1" flexDirection="column" overflow="hidden">
                <Box px={5} pt={4} pb={3} borderBottom="1px solid" borderColor={divColor} flexShrink={0}>
                  <HStack mb={2.5} align="start" spacing={3}>
                    <Text fontSize="11px" fontWeight="700" color={subColor} w="42px" flexShrink={0} pt="7px" letterSpacing="wider" textTransform="uppercase">CC</Text>
                    <Box flex="1">
                      <TagInput tags={ccList} setTags={setCcList} placeholder="Add CC…" colorScheme="purple" />
                    </Box>
                  </HStack>
                  <HStack align="center" spacing={3}>
                    <Text fontSize="11px" fontWeight="700" color={subColor} w="42px" flexShrink={0} letterSpacing="wider" textTransform="uppercase">Subject</Text>
                    <Input value={subject} onChange={e => setSubject(e.target.value)}
                      fontSize="13px" fontWeight="600" variant="unstyled" flex="1"
                      px={2} py={1} borderRadius="md" border="1px solid transparent"
                      _hover={{ borderColor: inputBorder }}
                      _focus={{ border: '1px solid', borderColor: 'blue.400', boxShadow: 'none' }} />
                  </HStack>
                </Box>
                <Box flex="1" p={3} overflow="hidden">
                  <RichTextEditor editorRef={editorRef} />
                </Box>
              </Flex>
            </Flex>
          )}
        </ModalBody>

        <Box borderTop="1px solid" borderColor={divColor} px={5} py={3} flexShrink={0}>
          {sendResult ? (
            <Flex justify="flex-end">
              <Button onClick={onClose} colorScheme="blue" size="sm" borderRadius="xl" px={6}>Close</Button>
            </Flex>
          ) : (
            <Flex justify="space-between" align="center">
              <Text fontSize="12px" color={subColor}>
                {totalCount > 0 ? `📤 Sending to ${totalCount} recipient${totalCount !== 1 ? 's' : ''}` : 'No recipients selected'}
              </Text>
              <HStack spacing={3}>
                <Button size="sm" variant="ghost" onClick={onClose} isDisabled={isSending} borderRadius="xl">Cancel</Button>
                <Button size="sm" leftIcon={<Icon as={PaperAirplaneIcon} w={4} h={4} />}
                  onClick={handleSend} isLoading={isSending} loadingText="Sending…"
                  isDisabled={totalCount === 0 || isSending} borderRadius="xl"
                  bgGradient={GRADIENT} color="white" fontWeight="700" px={5}
                  _hover={{ bgGradient: 'linear(to-br, #1e40af, #1d4ed8)', transform: 'translateY(-1px)' }}>
                  Send {totalCount > 0 ? `(${totalCount})` : ''}
                </Button>
              </HStack>
            </Flex>
          )}
        </Box>
      </ModalContent>
    </Modal>
  )
}

// ─── TopWinnerCard — large card for rank-1 nominee ───────────────────────────
function TopWinnerCard({ nominee, config, onDelete }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const cardBg = useColorModeValue('white', 'gray.800')
  const subColor = useColorModeValue('gray.500', 'gray.400')
  const borderColor = useColorModeValue(`${config.color}.200`, `${config.color}.700`)
  const scoreBg = useColorModeValue(`${config.color}.50`, `${config.color}.900`)
  const score = config.scoreField ? (nominee[config.scoreField] ?? '—') : computeTotal(nominee)

  const handleDelete = async e => {
    e.stopPropagation()
    setIsDeleting(true)
    try { await onDelete(nominee.id) } finally { setIsDeleting(false) }
  }

  return (
    <Card bg={cardBg} borderRadius="xl" border="2px solid" borderColor={borderColor}
      boxShadow="lg" overflow="hidden" position="relative"
      transition="transform 0.18s, box-shadow 0.18s"
      _hover={{ transform: 'translateY(-2px)', boxShadow: 'xl' }}>

      {/* Crown badge */}
      <Box position="absolute" top={2} left={3} zIndex={1}>
        <Badge colorScheme={config.color} borderRadius="full" px={2} py={0.5}
          fontSize="9px" fontWeight="800" display="flex" alignItems="center" gap={1}>
          <Icon as={StarSolid} w={2.5} h={2.5} />
          TOP PICK
        </Badge>
      </Box>

      {/* Delete */}
      <Tooltip label="Remove nominee" hasArrow fontSize="11px">
        <IconButton icon={<Icon as={TrashIcon} w={3.5} h={3.5} />}
          aria-label="Delete" size="xs" variant="ghost" colorScheme="red"
          position="absolute" top={1.5} right={1.5} zIndex={1}
          isLoading={isDeleting} onClick={handleDelete}
          opacity={0.4} _hover={{ opacity: 1 }} transition="opacity 0.15s" />
      </Tooltip>

      <Box bgGradient={config.gradient} h="4px" />
      <CardBody p={4} pt={7}>
        <VStack spacing={3} align="stretch">
          {/* Avatar + name */}
          <HStack spacing={3}>
            <Avatar name={nominee.name} src={`/api/photos/${nominee.student_id}`}
              size="md" border="3px solid" borderColor={`${config.color}.400`} boxShadow="md" />
            <VStack align="start" spacing={0} flex="1" minW={0}>
              <Text fontWeight="800" fontSize="15px" noOfLines={1}>{nominee.name}</Text>
              <Text fontSize="11px" color="blue.500" fontFamily="mono">{nominee.student_id?.trim()}</Text>
              <Text fontSize="10px" color={subColor} noOfLines={1}>{nominee.email}</Text>
            </VStack>
          </HStack>

          {/* Gender + Batch */}
          <HStack spacing={4}>
            <Box>
              <Text fontSize="8px" fontWeight="700" textTransform="uppercase" letterSpacing="wider" color={subColor}>Gender</Text>
              <Text fontSize="12px" fontWeight="700">{nominee.gender || '—'}</Text>
            </Box>
            <Box>
              <Text fontSize="8px" fontWeight="700" textTransform="uppercase" letterSpacing="wider" color={subColor}>Batch</Text>
              <Text fontSize="12px" fontWeight="700">{nominee.batch || '—'}</Text>
            </Box>
          </HStack>

          {/* Score */}
          <Box bg={scoreBg} borderRadius="lg" py={2} textAlign="center">
            <Text fontSize="8px" fontWeight="700" textTransform="uppercase"
              letterSpacing="wider" color={`${config.color}.600`}>{config.scoreLabel}</Text>
            <Text fontSize="24px" fontWeight="black" color={`${config.color}.600`} lineHeight="1.1">{score}</Text>
          </Box>
        </VStack>
      </CardBody>
    </Card>
  )
}

// ─── CompactRow — compressed list row for rank ≥ 2 ───────────────────────────
function CompactRow({ nominee, config, onDelete, rank }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const rowBg = useColorModeValue('gray.50', 'gray.750')
  const borderColor = useColorModeValue('gray.100', 'gray.700')
  const subColor = useColorModeValue('gray.500', 'gray.400')
  const score = config.scoreField ? (nominee[config.scoreField] ?? '—') : computeTotal(nominee)

  const handleDelete = async e => {
    e.stopPropagation()
    setIsDeleting(true)
    try { await onDelete(nominee.id) } finally { setIsDeleting(false) }
  }

  return (
    <HStack px={3} py={2} bg={rowBg} borderRadius="lg" border="1px solid"
      borderColor={borderColor} spacing={2.5} transition="background 0.12s"
      _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}>
      {/* Rank badge */}
      <Badge colorScheme="gray" borderRadius="full" w="20px" h="20px"
        display="flex" alignItems="center" justifyContent="center"
        fontSize="9px" fontWeight="800" flexShrink={0}>
        {rank}
      </Badge>

      {/* Name + meta */}
      <VStack align="start" spacing={0} flex="1" minW={0}>
        <Text fontSize="12px" fontWeight="600" noOfLines={1}>{nominee.name}</Text>
        <HStack spacing={2} divider={<Text color={subColor} fontSize="9px">·</Text>}>
          <Text fontSize="10px" color="blue.500" fontFamily="mono">{nominee.student_id?.trim()}</Text>
          <Text fontSize="10px" color={subColor}>{nominee.gender}</Text>
          <Text fontSize="10px" color={subColor}>{nominee.batch}</Text>
        </HStack>
      </VStack>

      {/* Score chip */}
      <Badge colorScheme={config.color} borderRadius="md" px={2} py={0.5}
        fontSize="10px" fontWeight="700" flexShrink={0}>
        {score}
      </Badge>

      {/* Delete */}
      <Tooltip label="Remove" hasArrow fontSize="11px">
        <IconButton icon={<Icon as={TrashIcon} w={3} h={3} />}
          aria-label="Delete" size="xs" variant="ghost" colorScheme="red"
          isLoading={isDeleting} onClick={handleDelete}
          opacity={0.35} _hover={{ opacity: 1 }} flexShrink={0} />
      </Tooltip>
    </HStack>
  )
}

// ─── AwardSection — top card + scrollable list ────────────────────────────────
function AwardSection({ title, nominees, config, onDelete }) {
  const colBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.600')
  const subColor = useColorModeValue('gray.500', 'gray.400')
  const divColor = useColorModeValue('gray.100', 'gray.700')

  // Split: top picks (rank 1 per gender) vs rest
  const topPicks = nominees.filter(n => n.is_top_pick || n.rank === 1)
  const rest = nominees.filter(n => !n.is_top_pick && n.rank !== 1)
    .sort((a, b) => (a.rank - b.rank) || (a.gender || '').localeCompare(b.gender || ''))

  return (
    <Box bg={colBg} border="1px solid" borderColor={borderColor}
      borderRadius="2xl" overflow="hidden" boxShadow="md"
      display="flex" flexDirection="column" h="560px">

      {/* Header */}
      <Box bgGradient={config.gradient} h="4px" flexShrink={0} />
      <Box px={4} py={3} borderBottom="1px solid" borderColor={borderColor} flexShrink={0}>
        <HStack justify="space-between" align="center">
          <HStack spacing={2}>
            <Text fontSize="18px" lineHeight="1">{config.icon}</Text>
            <VStack align="start" spacing={0}>
              <Text fontWeight="800" fontSize="13px" letterSpacing="-0.01em" noOfLines={1}>{title}</Text>
              <Text fontSize="9px" color={subColor}>{config.nomineeCount} nominees · {config.winnerLabel}</Text>
            </VStack>
          </HStack>
          <Badge colorScheme={config.color} borderRadius="full" px={2} fontSize="10px" fontWeight="700">
            {nominees.length}
          </Badge>
        </HStack>
      </Box>

      {/* Scrollable content */}
      <Box flex="1" overflowY="auto" p={3} sx={{
        '&::-webkit-scrollbar': { width: '4px' },
        '&::-webkit-scrollbar-thumb': { background: 'gray.300', borderRadius: '4px' },
      }}>
        {!nominees.length ? (
          <Box h="full" display="flex" alignItems="center" justifyContent="center">
            <VStack spacing={2} textAlign="center" px={4}>
              <Text fontSize="28px">{config.icon}</Text>
              <Text fontSize="12px" color={subColor} lineHeight="1.5">
                No nominees yet.<br />Click <b>Generate Nominations</b> to run selection.
              </Text>
            </VStack>
          </Box>
        ) : (
          <VStack spacing={3} align="stretch">
            {/* Top picks — full cards */}
            {topPicks.length > 0 && (
              <SimpleGrid columns={topPicks.length === 1 ? 1 : 2} spacing={2}>
                {topPicks.map(n => (
                  <TopWinnerCard key={n.id} nominee={n} config={config} onDelete={onDelete} />
                ))}
              </SimpleGrid>
            )}

            {/* Rest — compact rows */}
            {rest.length > 0 && (
              <>
                {topPicks.length > 0 && (
                  <HStack spacing={2}>
                    <Box flex="1" h="1px" bg={divColor} />
                    <Text fontSize="9px" fontWeight="700" textTransform="uppercase"
                      letterSpacing="wider" color={subColor}>Runners-up</Text>
                    <Box flex="1" h="1px" bg={divColor} />
                  </HStack>
                )}
                <VStack spacing={1.5} align="stretch">
                  {rest.map(n => (
                    <CompactRow key={n.id} nominee={n} config={config}
                      onDelete={onDelete} rank={n.rank} />
                  ))}
                </VStack>
              </>
            )}
          </VStack>
        )}
      </Box>
    </Box>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function NominationView() {
  const toast = useToast()
  const bgColor = useColorModeValue('gray.50', 'gray.900')
  const cardBg = useColorModeValue('white', 'gray.800')
  const subColor = useColorModeValue('gray.500', 'gray.400')
  const borderColor = useColorModeValue('gray.200', 'gray.600')

  const { isOpen: isComposeOpen, onOpen: onComposeOpen, onClose: onComposeClose } = useDisclosure()
  const [nominees, setNominees] = useState([])
  const [communicationGroups, setCommunicationGroups] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  const loadNominees = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await nominationService.getNominations()
      setNominees(res?.data || [])
      const commRes = await nominationService.getCommunicationGroups()
      setCommunicationGroups(commRes?.data || {})
    } catch (err) {
      toast({ title: 'Error loading nominations', description: err.message, status: 'error', duration: 4000 })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => { loadNominees() }, [loadNominees])

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const res = await nominationService.generateNominations()
      setNominees(res?.nominees || [])
      toast({ title: `Generated ${res?.count || 0} nominees`, status: 'success', duration: 3000 })
    } catch (err) {
      toast({ title: 'Generation failed', description: err.message, status: 'error', duration: 4000 })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDelete = useCallback(async (id) => {
    const previous = nominees
    setNominees(prev => prev.filter(n => n.id !== id))
    try {
      const res = await nominationService.deleteNominee(id)
      toast({ title: res.message || 'Nominee removed', status: 'success', duration: 3000, isClosable: true })
    } catch (err) {
      setNominees(previous)
      toast({ title: 'Delete failed', description: err.message, status: 'error', duration: 5000, isClosable: true })
    }
  }, [nominees])

  const grouped = {}
  for (const n of nominees) {
    const k = n.award_name || 'Unknown'
    if (!grouped[k]) grouped[k] = []
    grouped[k].push(n)
  }

  const topPickCount = nominees.filter(n => n.is_top_pick || n.rank === 1).length

  return (
    <Box p={[3, 5, 8]} pt={[1, 2, 3]} bg={bgColor} minH="100vh">

      {/* Header card */}
      <Card bg={cardBg} borderRadius="2xl" boxShadow="sm"
        border="1px solid" borderColor={borderColor} mb={6}>
        <CardBody p={6}>
          <Flex align="center" justify="space-between" flexWrap="wrap" gap={4}>
            <HStack spacing={4}>
              <Box w="48px" h="48px" borderRadius="xl" bgGradient={GRADIENT}
                display="flex" alignItems="center" justifyContent="center" boxShadow="lg">
                <Icon as={TrophyIcon} color="white" w={6} h={6} />
              </Box>
              <VStack align="start" spacing={0}>
                <Text fontSize="xl" fontWeight="black" letterSpacing="-0.02em">Award Nominations</Text>
                <Text fontSize="sm" color={subColor}>
                  Sports &amp; Cultural: top 5M+5F · Trailblazer: top 3M+3F
                </Text>
              </VStack>
            </HStack>

            <HStack spacing={3}>
              <Tooltip label="Recalculate all nominations — overwrites existing" hasArrow>
                <Button size="sm" leftIcon={<Icon as={SparklesIcon} w={4} h={4} />}
                  onClick={handleGenerate} isLoading={isGenerating} loadingText="Generating…"
                  borderRadius="xl" color="white" fontWeight="700"
                  bgGradient="linear(to-br, #065f46, #10b981)" boxShadow="md"
                  _hover={{ bgGradient: 'linear(to-br, #047857, #059669)', transform: 'translateY(-1px)' }}>
                  Generate Nominations
                </Button>
              </Tooltip>

              <Tooltip label={nominees.length === 0 ? 'Generate first' : 'Send email notifications'} hasArrow>
                <Button size="sm" color="white" leftIcon={<Icon as={EnvelopeIcon} w={4} h={4} />}
                  onClick={onComposeOpen} isDisabled={nominees.length === 0}
                  borderRadius="xl" bgGradient={GRADIENT} boxShadow="md" fontWeight="700"
                  _hover={{ bgGradient: 'linear(to-br, #1e40af, #1d4ed8)', transform: 'translateY(-1px)' }}>
                  Send Notification
                </Button>
              </Tooltip>
            </HStack>
          </Flex>

          {nominees.length > 0 && (
            <>
              <Divider my={4} />
              <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
                <Stat>
                  <StatLabel fontSize="10px" textTransform="uppercase" letterSpacing="wider" color={subColor}>Total Nominees</StatLabel>
                  <StatNumber fontSize="2xl">{nominees.length}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel fontSize="10px" textTransform="uppercase" letterSpacing="wider" color={subColor}>🏅 Sports</StatLabel>
                  <StatNumber fontSize="2xl">{(grouped['SportsPerson of The Year Award'] || []).length}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel fontSize="10px" textTransform="uppercase" letterSpacing="wider" color={subColor}>🎭 Cultural</StatLabel>
                  <StatNumber fontSize="2xl">{(grouped['Best in Co-curricular Activities'] || []).length}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel fontSize="10px" textTransform="uppercase" letterSpacing="wider" color={subColor}>🔥 Trailblazer</StatLabel>
                  <StatNumber fontSize="2xl">{(grouped['Trailblazer Award'] || []).length}</StatNumber>
                </Stat>
              </SimpleGrid>
            </>
          )}
        </CardBody>
      </Card>

      {/* Award columns */}
      {isLoading ? (
        <Center py={16}>
          <VStack spacing={4}>
            <Spinner size="xl" thickness="4px" color="blue.500" />
            <Text color={subColor}>Loading nominations…</Text>
          </VStack>
        </Center>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={5} alignItems="start">
          {AWARD_ORDER.map(award => (
            <AwardSection key={award} title={award}
              nominees={grouped[award] || []}
              config={AWARD_CONFIG[award]}
              onDelete={handleDelete} />
          ))}
        </SimpleGrid>
      )}

      <ComposeModal isOpen={isComposeOpen} onClose={onComposeClose} communicationGroups={communicationGroups} />
    </Box>
  )
}