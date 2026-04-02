// src/pages/NominationView.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box, Button, Text, VStack, HStack, SimpleGrid, Card, CardBody,
  Badge, Avatar, Divider, Spinner, Center, useToast, useColorModeValue,
  Flex, Icon, Stat, StatLabel, StatNumber, useDisclosure, Tooltip,
  Alert, AlertIcon, AlertDescription, AlertTitle,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  ModalCloseButton, Checkbox, Input, IconButton,
} from '@chakra-ui/react'
import {
  TrophyIcon, SparklesIcon, EnvelopeIcon, PaperAirplaneIcon,
  CheckCircleIcon, ExclamationCircleIcon, XMarkIcon, TrashIcon,
} from '@heroicons/react/24/outline'

// ← axios removed; nominationService handles all calls now
import { nominationService } from '../services/nominationService'

const GRADIENT = 'linear(to-br, #1e3a8a, #2563eb)'

// ─── Award config (unchanged) ─────────────────────────────────────────────────
const AWARD_CONFIG = {
  'Sports Person Award': {
    color: 'blue', gradient: 'linear(to-br, #1e40af, #3b82f6)',
    icon: '🏅', scoreLabel: 'Sports Verified Score', scoreField: 'sports_verified_score',
  },
  'Co-curricular Person Award': {
    color: 'pink', gradient: 'linear(to-br, #9d174d, #ec4899)',
    icon: '🎭', scoreLabel: 'Cultural Verified Score', scoreField: 'cultural_verified_score',
  },
  'Trailblazer Award': {
    color: 'orange', gradient: 'linear(to-br, #92400e, #f59e0b)',
    icon: '🔥', scoreLabel: 'Total Score', scoreField: null,
  },
}
const AWARD_ORDER = ['Sports Person Award', 'Co-curricular Person Award', 'Trailblazer Award']

function computeTotal(n) {
  const vals = [
    parseFloat(n.sports_verified_score),
    parseFloat(n.cultural_verified_score),
    parseFloat(n.academic_verified_score),
  ].filter(v => !isNaN(v))
  return vals.length ? vals.reduce((a, b) => a + b, 0).toFixed(2) : '—'
}

const isValidEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

// ─── TagInput (unchanged) ─────────────────────────────────────────────────────
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

// ─── ToolBtn (unchanged) ──────────────────────────────────────────────────────
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

// ─── RichTextEditor (unchanged) ───────────────────────────────────────────────
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
          <ToolBtn label="S" onExec={() => exec('strikeThrough')} title="Strikethrough" btnStyle={{ textDecoration: 'line-through' }} />
          <ToolSep />
          <ToolBtn label="•" onExec={() => exec('insertUnorderedList')} title="Bullet List" />
          <ToolBtn label="1." onExec={() => exec('insertOrderedList')} title="Numbered List" />
          <ToolSep />
          <ToolBtn label="H1" onExec={() => exec('formatBlock', 'h2')} title="Heading" btnStyle={{ fontWeight: 800, fontSize: '10px' }} />
          <ToolBtn label="¶" onExec={() => exec('formatBlock', 'p')} title="Paragraph" btnStyle={{ fontSize: '13px' }} />
          <ToolSep />
          <ToolBtn label="⬅" onExec={() => exec('justifyLeft')} title="Align Left" />
          <ToolBtn label="⬛" onExec={() => exec('justifyCenter')} title="Align Center" />
          <ToolBtn label="➡" onExec={() => exec('justifyRight')} title="Align Right" />
          <ToolSep />
          <ToolBtn label="—" onExec={() => exec('insertHorizontalRule')} title="Horizontal Rule" />
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
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
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
            '& hr': { border: 'none', borderTop: '1px solid', borderColor: 'gray.200', my: '10px' },
          }}
        />
      </Box>
    </Box>
  )
}

// ─── ComposeModal — only handleSend updated to use nominationService ──────────
function ComposeModal({ isOpen, onClose, nominees }) {
  const toast = useToast()
  const editorRef = useRef(null)

  const modalBg = useColorModeValue('white', 'gray.800')
  const leftBg = useColorModeValue('gray.50', 'gray.900')
  const divColor = useColorModeValue('gray.200', 'gray.600')
  const subColor = useColorModeValue('gray.500', 'gray.400')
  const rowHover = useColorModeValue('gray.100', 'gray.700')
  const inputBorder = useColorModeValue('gray.200', 'gray.600')
  const sentBg = useColorModeValue('green.50', 'green.900')
  const failedBg = useColorModeValue('red.50', 'red.900')

  const [selectedIds, setSelectedIds] = useState(new Set())
  const [extraRecipients, setExtraRecipients] = useState([])
  const [ccList, setCcList] = useState([])
  const [subject, setSubject] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(nominees.map(n => n.id)))
      setExtraRecipients([])
      setCcList([])
      setSubject('🏆 FLAME Awards — Official Nomination Notification')
      setSendResult(null)
      setIsSending(false)
      setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = '' }, 60)
    }
  }, [isOpen, nominees])

  const allSelected = nominees.length > 0 && selectedIds.size === nominees.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < nominees.length

  const toggleNominee = id =>
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const toggleAll = checked =>
    setSelectedIds(checked ? new Set(nominees.map(n => n.id)) : new Set())

  const selectedEmails = nominees.filter(n => selectedIds.has(n.id)).map(n => n.email)
  const allEmails = [...new Set([...selectedEmails, ...extraRecipients])]
  const totalCount = allEmails.length

  // ← Now uses nominationService instead of inline axios
  const handleSend = async () => {
    const body = editorRef.current?.innerHTML || ''
    if (!totalCount) { toast({ title: 'Select at least one recipient', status: 'warning', duration: 3000, isClosable: true }); return }
    if (!subject.trim()) { toast({ title: 'Subject is required', status: 'warning', duration: 3000, isClosable: true }); return }
    if (!body || body === '<br>' || body.trim() === '') {
      toast({ title: 'Email body cannot be empty', status: 'warning', duration: 3000, isClosable: true }); return
    }
    setIsSending(true)
    try {
      const result = await nominationService.sendNotifications({
        to: allEmails, cc: ccList, subject: subject.trim(), html: body,
      })
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
              display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
              <Icon as={EnvelopeIcon} color="white" w={5} h={5} />
            </Box>
            <VStack align="start" spacing={0}>
              <Text color="white" fontWeight="800" fontSize="16px" letterSpacing="-0.01em">
                Send Award Notification
              </Text>
              <Text color="whiteAlpha.700" fontSize="11px">
                Compose and send personalised notifications to nominees
              </Text>
            </VStack>
          </HStack>
        </Box>

        <ModalBody p={0} overflow="hidden">
          {sendResult ? (
            <Box p={8}>
              <VStack spacing={5} align="stretch">
                <Alert
                  status={sendResult.failed === 0 ? 'success' : sendResult.sent === 0 ? 'error' : 'warning'}
                  borderRadius="2xl" p={5} variant="left-accent"
                >
                  <AlertIcon boxSize={6} />
                  <Box>
                    <AlertTitle fontWeight="800" fontSize="15px">
                      {sendResult.failed === 0
                        ? `✅ All ${sendResult.sent} emails sent successfully!`
                        : sendResult.sent === 0
                          ? `❌ All ${sendResult.failed} emails failed to send`
                          : `⚠️ ${sendResult.sent} sent · ${sendResult.failed} failed`}
                    </AlertTitle>
                    {sendResult.failed > 0 && (
                      <AlertDescription fontSize="12px" mt={1} color="inherit">
                        Failed: {sendResult.details.failed.map(f => f.email).join(', ')}
                      </AlertDescription>
                    )}
                  </Box>
                </Alert>

                {sendResult.details?.sent?.length > 0 && (
                  <Box>
                    <Text fontSize="10px" fontWeight="700" textTransform="uppercase"
                      letterSpacing="wider" color={subColor} mb={2}>Successfully Sent To</Text>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={1}>
                      {sendResult.details.sent.map(email => (
                        <HStack key={email} spacing={2} p={2} borderRadius="lg" bg={sentBg}>
                          <Icon as={CheckCircleIcon} color="green.500" w={4} h={4} flexShrink={0} />
                          <Text fontSize="12px" noOfLines={1}>{email}</Text>
                        </HStack>
                      ))}
                    </SimpleGrid>
                  </Box>
                )}

                {sendResult.details?.failed?.length > 0 && (
                  <Box>
                    <Text fontSize="10px" fontWeight="700" textTransform="uppercase"
                      letterSpacing="wider" color={subColor} mb={2}>Failed</Text>
                    <VStack align="stretch" spacing={1}>
                      {sendResult.details.failed.map(f => (
                        <HStack key={f.email} spacing={2} p={2} borderRadius="lg" bg={failedBg}>
                          <Icon as={ExclamationCircleIcon} color="red.500" w={4} h={4} flexShrink={0} />
                          <VStack align="start" spacing={0} flex="1" minW={0}>
                            <Text fontSize="12px" fontWeight="600" noOfLines={1}>{f.email}</Text>
                            <Text fontSize="10px" color={subColor} noOfLines={1}>{f.error}</Text>
                          </VStack>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>
                )}
              </VStack>
            </Box>
          ) : (
            <Flex h="calc(90vh - 148px)" overflow="hidden">
              <Box w="310px" flexShrink={0} bg={leftBg} borderRight="1px solid"
                borderColor={divColor} display="flex" flexDirection="column" overflow="hidden">
                <Box p={4} borderBottom="1px solid" borderColor={divColor} flexShrink={0}>
                  <Text fontSize="10px" fontWeight="700" textTransform="uppercase"
                    letterSpacing="wider" color={subColor} mb={2}>Nominees</Text>
                  <Checkbox
                    isChecked={allSelected} isIndeterminate={someSelected}
                    onChange={e => toggleAll(e.target.checked)}
                    fontSize="13px" fontWeight="600" colorScheme="blue"
                  >
                    Select All
                    <Badge ml={2} colorScheme="blue" borderRadius="full" fontSize="9px" fontWeight="700">
                      {nominees.length}
                    </Badge>
                  </Checkbox>
                </Box>

                <Box flex="1" overflowY="auto" p={3}>
                  {AWARD_ORDER.map(award => {
                    const group = nominees.filter(n => n.award_name === award)
                    if (!group.length) return null
                    const cfg = AWARD_CONFIG[award]
                    return (
                      <Box key={award} mb={4}>
                        <HStack mb={1.5}>
                          <Text fontSize="9px" fontWeight="700" textTransform="uppercase"
                            letterSpacing="wider" color={subColor}>{cfg.icon} {award}</Text>
                        </HStack>
                        <VStack spacing={0.5} align="stretch">
                          {group.map(n => (
                            <HStack key={n.id} p={1.5} borderRadius="lg" cursor="pointer" spacing={2}
                              bg={selectedIds.has(n.id) ? `${cfg.color}.50` : 'transparent'}
                              _hover={{ bg: rowHover }}
                              onClick={() => toggleNominee(n.id)}
                              transition="background 0.1s"
                            >
                              <Checkbox
                                isChecked={selectedIds.has(n.id)} colorScheme={cfg.color}
                                onClick={e => e.stopPropagation()}
                                onChange={() => toggleNominee(n.id)}
                                flexShrink={0}
                              />
                              <VStack align="start" spacing={0} flex="1" minW={0}>
                                <Text fontSize="12px" fontWeight="600" noOfLines={1}>{n.name}</Text>
                                <Text fontSize="10px" color={subColor} noOfLines={1}>{n.email}</Text>
                              </VStack>
                            </HStack>
                          ))}
                        </VStack>
                      </Box>
                    )
                  })}
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
                    <Text fontSize="11px" fontWeight="700" color={subColor}
                      w="42px" flexShrink={0} pt="7px" letterSpacing="wider" textTransform="uppercase">
                      CC
                    </Text>
                    <Box flex="1">
                      <TagInput tags={ccList} setTags={setCcList}
                        placeholder="Add CC recipients… (Enter to add)" colorScheme="purple" />
                    </Box>
                  </HStack>
                  <HStack align="center" spacing={3}>
                    <Text fontSize="11px" fontWeight="700" color={subColor}
                      w="42px" flexShrink={0} letterSpacing="wider" textTransform="uppercase">
                      Subject
                    </Text>
                    <Input
                      value={subject} onChange={e => setSubject(e.target.value)}
                      fontSize="13px" fontWeight="600" variant="unstyled"
                      placeholder="Email subject line…" flex="1"
                      px={2} py={1} borderRadius="md"
                      border="1px solid transparent"
                      _hover={{ borderColor: inputBorder }}
                      _focus={{ border: '1px solid', borderColor: 'blue.400', boxShadow: 'none' }}
                    />
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
              <Text fontSize="12px" color={subColor} fontStyle={totalCount > 0 ? 'normal' : 'italic'}>
                {totalCount > 0
                  ? `📤 Sending to ${totalCount} recipient${totalCount !== 1 ? 's' : ''}${ccList.length ? ` · ${ccList.length} CC` : ''}`
                  : 'No recipients selected'}
              </Text>
              <HStack spacing={3}>
                <Button size="sm" variant="ghost" onClick={onClose}
                  isDisabled={isSending} borderRadius="xl" fontSize="13px">Cancel</Button>
                <Button
                  size="sm"
                  leftIcon={<Icon as={PaperAirplaneIcon} w={4} h={4} />}
                  onClick={handleSend}
                  isLoading={isSending}
                  loadingText="Sending…"
                  isDisabled={totalCount === 0 || isSending}
                  borderRadius="xl"
                  bgGradient={GRADIENT}
                  color="white" fontWeight="700" px={5} boxShadow="md"
                  _hover={{ bgGradient: 'linear(to-br, #1e40af, #1d4ed8)', transform: 'translateY(-1px)', boxShadow: 'lg' }}
                  _active={{ transform: 'translateY(0)' }}
                  transition="all 0.15s"
                >
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

// ─── WinnerCard — delete icon added ──────────────────────────────────────────
// onDelete prop is called with nominee.id when the trash icon is clicked
function WinnerCard({ nominee, config, onDelete }) {
  const [isDeleting, setIsDeleting] = useState(false)

  const cardBg = useColorModeValue('white', 'gray.800')
  const subColor = useColorModeValue('gray.500', 'gray.400')
  const borderColor = useColorModeValue('gray.200', 'gray.600')
  const scoreBg = useColorModeValue(`${config.color}.50`, `${config.color}.900`)
  const score = config.scoreField ? (nominee[config.scoreField] ?? '—') : computeTotal(nominee)
  const photoSrc = `/api/photos/${nominee.student_id}`

  const handleDelete = async (e) => {
    e.stopPropagation()
    setIsDeleting(true)
    try {
      await onDelete(nominee.id)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card bg={cardBg} borderRadius="xl" boxShadow="sm" border="1px solid"
      borderColor={borderColor} overflow="hidden"
      transition="transform 0.18s, box-shadow 0.18s"
      _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
      position="relative"   // ← needed so the absolute delete btn positions inside the card
    >
      {/* ── Delete button — top-right corner ── */}
      <Tooltip label="Remove nominee" hasArrow fontSize="11px">
        <IconButton
          icon={<Icon as={TrashIcon} w={3.5} h={3.5} />}
          aria-label="Delete nominee"
          size="xs"
          variant="ghost"
          colorScheme="red"
          position="absolute"
          top={1.5}
          right={1.5}
          zIndex={1}
          isLoading={isDeleting}
          onClick={handleDelete}
          borderRadius="lg"
          opacity={0.5}
          _hover={{ opacity: 1, bg: 'red.50' }}
          transition="opacity 0.15s"
        />
      </Tooltip>

      <Box bgGradient={config.gradient} h="3px" />
      <CardBody p={3}>
        <VStack spacing={2} align="stretch">
          <HStack spacing={2.5}>
            <Avatar
              name={nominee.name}
              src={photoSrc}
              size="sm"
              border="2px solid"
              borderColor={`${config.color}.400`}
              boxShadow="sm"
            />
            <VStack align="start" spacing={0} flex="1" minW={0}>
              <Text fontWeight="700" fontSize="13px" noOfLines={1}>{nominee.name}</Text>
              <Text fontSize="10px" color="blue.500" fontFamily="mono">{nominee.student_id}</Text>
              <Text fontSize="9px" color={subColor} noOfLines={1}>{nominee.email}</Text>
            </VStack>
          </HStack>

          <HStack spacing={4}>
            <Box>
              <Text fontSize="8px" fontWeight="700" textTransform="uppercase"
                letterSpacing="wider" color={subColor}>Gender</Text>
              <Text fontSize="11px" fontWeight="600">{nominee.gender || '—'}</Text>
            </Box>
            <Box>
              <Text fontSize="8px" fontWeight="700" textTransform="uppercase"
                letterSpacing="wider" color={subColor}>Batch</Text>
              <Text fontSize="11px" fontWeight="600">{nominee.batch || '—'}</Text>
            </Box>
          </HStack>

          <Box bg={scoreBg} borderRadius="lg" py={1.5} textAlign="center">
            <Text fontSize="8px" fontWeight="700" textTransform="uppercase"
              letterSpacing="wider" color={`${config.color}.600`}>{config.scoreLabel}</Text>
            <Text fontSize="20px" fontWeight="black"
              color={`${config.color}.600`} lineHeight="1.1">{score}</Text>
          </Box>
        </VStack>
      </CardBody>
    </Card>
  )
}

// ─── AwardSection — receives onDelete and passes it down ─────────────────────
function AwardSection({ title, nominees, config, onDelete }) {
  const colBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('gray.200', 'gray.600')
  const subColor = useColorModeValue('gray.500', 'gray.400')

  return (
    <Box
      bg={colBg} border="1px solid" borderColor={borderColor}
      borderRadius="2xl" overflow="hidden" boxShadow="md"
      display="flex" flexDirection="column" h="480px"
    >
      <Box bgGradient={config.gradient} h="5px" flexShrink={0} />
      <Box px={4} py={3} borderBottom="1px solid" borderColor={borderColor} flexShrink={0}>
        <HStack justify="space-between" align="center">
          <HStack spacing={2}>
            <Text fontSize="18px" lineHeight="1">{config.icon}</Text>
            <Text fontWeight="800" fontSize="13px" letterSpacing="-0.01em" noOfLines={1}>{title}</Text>
          </HStack>
          <Badge colorScheme={config.color} borderRadius="full" px={2} py={0.5} fontSize="10px" fontWeight="700">
            {nominees.length} {nominees.length === 1 ? 'Nominee' : 'Nominees'}
          </Badge>
        </HStack>
      </Box>

      <Box flex="1" overflowY="auto" p={3}
        sx={{
          '&::-webkit-scrollbar': { width: '4px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { background: 'gray.300', borderRadius: '4px' },
        }}
      >
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
            {nominees.map(n => (
              <WinnerCard key={n.id} nominee={n} config={config} onDelete={onDelete} />
            ))}
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
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  // ← loadNominees uses nominationService now
  const loadNominees = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await nominationService.getNominations()
      setNominees(res?.data || [])
    } catch (err) {
      toast({ title: 'Error loading nominations', description: err.message, status: 'error', duration: 4000 })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadNominees() }, [loadNominees])

  // ← generateNominations uses nominationService now
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

  // ← New: delete a single nominee optimistically
  const handleDelete = useCallback(async (id) => {
    // Optimistic remove — feels instant
    const previous = nominees
    setNominees(prev => prev.filter(n => n.id !== id))

    try {
      const res = await nominationService.deleteNominee(id)
      toast({ title: res.message || 'Nominee removed', status: 'success', duration: 3000, isClosable: true })
    } catch (err) {
      // Roll back on failure
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

  return (
    <Box p={[3, 5, 8]} pt={[1, 2, 3]} bg={bgColor} minH="100vh">

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
                <Text fontSize="sm" color={subColor}>Top performers selected per verified score</Text>
              </VStack>
            </HStack>

            <HStack spacing={3}>
              <Tooltip label="Recalculate all nominations — overwrites existing" hasArrow>
                <Button size="sm"
                  leftIcon={<Icon as={SparklesIcon} w={4} h={4} />}
                  onClick={handleGenerate} isLoading={isGenerating}
                  loadingText="Generating…" borderRadius="xl"
                  color="white" fontWeight="700"
                  bgGradient="linear(to-br, #065f46, #10b981)"
                  boxShadow="md"
                  _hover={{ bgGradient: 'linear(to-br, #047857, #059669)', transform: 'translateY(-1px)', boxShadow: 'lg' }}
                  _active={{ transform: 'translateY(0)' }}
                  transition="all 0.15s"
                >
                  Generate Nominations
                </Button>
              </Tooltip>

              <Tooltip label={nominees.length === 0 ? 'Generate nominations first' : 'Send email notifications to nominees'} hasArrow>
                <Button
                  size="sm" color="white"
                  leftIcon={<Icon as={EnvelopeIcon} w={4} h={4} />}
                  onClick={onComposeOpen}
                  isDisabled={nominees.length === 0}
                  borderRadius="xl"
                  bgGradient="linear(to-br, #1e3a8a, #2563eb)"
                  boxShadow="md" fontWeight="700"
                  _hover={{ bgGradient: 'linear(to-br, #1e40af, #1d4ed8)', transform: 'translateY(-1px)', boxShadow: 'lg' }}
                  _active={{ transform: 'translateY(0)' }}
                  transition="all 0.15s"
                >
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
                {AWARD_ORDER.map(award => (
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
            <AwardSection
              key={award}
              title={award}
              nominees={grouped[award] || []}
              config={AWARD_CONFIG[award]}
              onDelete={handleDelete}   // ← wired in
            />
          ))}
        </SimpleGrid>
      )}

      <ComposeModal isOpen={isComposeOpen} onClose={onComposeClose} nominees={nominees} />
    </Box>
  )
}