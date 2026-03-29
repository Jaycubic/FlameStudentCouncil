// src/pages/EmployeeDashboard.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box, Flex, VStack, HStack, Text, Heading, Avatar, Badge, Button,
  Input, FormControl, FormLabel, Select, Divider, useToast,
  Spinner, Center, Icon, Tag, IconButton, Tooltip, SimpleGrid,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalCloseButton, useDisclosure, InputGroup, InputLeftElement,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer,
} from '@chakra-ui/react'
import {
  UserIcon, IdentificationIcon, BuildingOfficeIcon,
  CameraIcon, DocumentIcon, CreditCardIcon, BanknotesIcon,
  ArrowUpTrayIcon, EyeIcon, CheckCircleIcon, MagnifyingGlassIcon,
  PencilSquareIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import { facultyProfileService } from '../services/facultyProfileService'

// ─── helpers ────────────────────────────────────────────────────────────────
const userRole = () => {
  try {
    const raw = localStorage.getItem('user')
    const u = raw ? JSON.parse(raw) : {}
    return u.role || ''
  } catch { return '' }
}
const userEmployeeId = () => {
  try {
    const raw = localStorage.getItem('user')
    const u = raw ? JSON.parse(raw) : {}
    return u.employee_id || u.employeeId || ''
  } catch { return '' }
}

const ATTACHMENT_TYPES = ['pan', 'aadhar', 'cheque', 'photo']
const sectionCard = (children, extra = {}) => ({
  bg: 'white',
  borderRadius: 'xl',
  boxShadow: 'sm',
  border: '1px solid',
  borderColor: 'gray.100',
  p: 6,
  ...extra,
  children,
})

// ─── UploadButton component ──────────────────────────────────────────────────
function UploadButton({ label, accept, onFileSelected, isLoading, currentFile, colorScheme = 'vrv' }) {
  const inputRef = useRef(null)
  return (
    <VStack align="start" spacing={1} w="full">
      <HStack>
        <Button
          size="sm"
          leftIcon={<Icon as={ArrowUpTrayIcon} boxSize={4} />}
          colorScheme={colorScheme}
          variant="outline"
          isLoading={isLoading}
          onClick={() => inputRef.current?.click()}
        >
          {label}
        </Button>
        {currentFile && (
          <Tag size="sm" colorScheme="green" borderRadius="full">
            <Icon as={CheckCircleIcon} boxSize={3} mr={1} />
            {currentFile}
          </Tag>
        )}
      </HStack>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files?.[0]) onFileSelected(e.target.files[0]) }}
      />
      <Text fontSize="xs" color="gray.400">Allowed: PDF, JPG, JPEG, PNG (max 10 MB)</Text>
    </VStack>
  )
}

// ─── Secure Image Component ──────────────────────────────────────────────────
function SecureImage({ url, name, size = '2xl', ...props }) {
  const [src, setSrc] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let objectUrl = null
    if (url) {
      setLoading(true)
      facultyProfileService.getFileBlobUrl(url)
        .then(u => {
          objectUrl = u
          setSrc(u)
        })
        .catch(() => setSrc(null))
        .finally(() => setLoading(false))
    } else {
      setSrc(null)
      setLoading(false)
    }
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [url])

  if (loading) return <Center w="120px" h="120px"><Spinner size="md" color="vrv.500" /></Center>

  return <Avatar size={size} name={name} src={src} {...props} />
}

// ─── AttachmentPreview ───────────────────────────────────────────────────────
function AttachmentPreview({ employee_id, type, label }) {
  const [previewing, setPreviewing] = useState(false)
  const url = employee_id ? facultyProfileService.getAttachmentUrl(employee_id, type) : null

  const handlePreview = async (e) => {
    e.preventDefault()
    if (!url) return
    setPreviewing(true)
    try {
      const blobUrl = await facultyProfileService.getFileBlobUrl(url)
      window.open(blobUrl, '_blank')
    } catch (err) {
      console.error('Preview failed', err)
    } finally { setPreviewing(false) }
  }

  if (!url) return null

  return (
    <Tooltip label={`View ${label}`}>
      <IconButton
        onClick={handlePreview}
        isLoading={previewing}
        icon={<Icon as={EyeIcon} />}
        size="sm"
        variant="ghost"
        colorScheme="blue"
        aria-label={`View ${label}`}
      />
    </Tooltip>
  )
}

// ─── ProfileView ─────────────────────────────────────────────────────────────
function ProfileView({ profile, onEdit, isAdmin }) {
  const empId = profile?.employee_id
  const photoUrl = profile?.self_photo
    ? facultyProfileService.getAttachmentUrl(empId, 'photo')
    : null

  return (
    <Box>
      {/* Hero banner */}
      <Box
        bg="#e3f0f8"
        borderRadius="2xl"
        p={{ base: 6, md: 10 }}
        mb={6}
        position="relative"
        overflow="hidden"
      >

        <Flex align="center" gap={6} flexWrap="wrap">
          <SecureImage
            size="2xl"
            name={profile?.name}
            url={photoUrl}
            border="4px solid white"
            boxShadow="xl"
          />
          <VStack align="start" spacing={1} color="gray.800">
            <Heading size="lg" fontFamily="'Space Grotesk', sans-serif">
              {profile?.name || '—'}
            </Heading>
            <Text fontSize="md" opacity={0.85}>{profile?.designation || '—'}</Text>
            <HStack mt={1} flexWrap="wrap" gap={2}>
              {profile?.regular_visiting && (
                <Badge
                  colorScheme={profile.regular_visiting.toLowerCase().includes('visit') ? 'orange' : 'green'}
                  borderRadius="full" px={3} py={0.5} fontSize="xs"
                >
                  {profile.regular_visiting}
                </Badge>
              )}
              <Badge colorScheme="blackAlpha" borderRadius="full" px={3} py={0.5} fontSize="xs">
                {profile?.employee_id}
              </Badge>
            </HStack>
          </VStack>
          <Box flex={1} />
          {(isAdmin || userEmployeeId() === empId) && (
            <Button
              leftIcon={<Icon as={PencilSquareIcon} boxSize={4} />}
              colorScheme="blackAlpha"
              variant="solid"
              size="sm"
              onClick={onEdit}
            >
              Edit Profile
            </Button>
          )}
        </Flex>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={5}>
        {/* Employment Details */}
        <Box {...sectionCard(null)} gridColumn={{ lg: 'span 2' }}>
          <HStack mb={4}>
            <Icon as={IdentificationIcon} boxSize={5} color="vrv.500" />
            <Heading size="sm" color="vrv.700">Employment Details</Heading>
          </HStack>
          <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
            {[
              ['Employee ID', profile?.employee_id],
              ['Designation', profile?.designation],
              ['Reporting Manager', profile?.reporting_manager],
              ['School', profile?.school?.name],
              ['Department', profile?.department?.name],
              ['Area', profile?.area?.name],
              ['Email', profile?.email],
              ['Mobile', profile?.mobile],
            ].map(([lbl, val]) => (
              <Box key={lbl}>
                <Text fontSize="xs" color="gray.400" fontWeight="600" textTransform="uppercase" mb={0.5}>{lbl}</Text>
                <Text fontSize="sm" fontWeight="500" color="gray.700">{val || <Text as="span" color="gray.300">—</Text>}</Text>
              </Box>
            ))}
          </SimpleGrid>
        </Box>

        {/* Address & GST */}
        <Box {...sectionCard(null)}>
          <HStack mb={4}>
            <Icon as={BuildingOfficeIcon} boxSize={5} color="vrv.500" />
            <Heading size="sm" color="vrv.700">Additional Info</Heading>
          </HStack>
          <VStack align="start" spacing={3}>
            {[
              ['Address', profile?.address],
              ['Company Name', profile?.company_name],
              ['GST Number', profile?.gst_number],
              ['Workload', profile?.workload],
            ].map(([lbl, val]) => (
              <Box key={lbl} w="full">
                <Text fontSize="xs" color="gray.400" fontWeight="600" textTransform="uppercase" mb={0.5}>{lbl}</Text>
                <Text fontSize="sm" fontWeight="500" color="gray.700">{val || <Text as="span" color="gray.300">—</Text>}</Text>
              </Box>
            ))}
          </VStack>
        </Box>

        {/* PAN Card */}
        <Box {...sectionCard(null)}>
          <HStack mb={4}>
            <Icon as={CreditCardIcon} boxSize={5} color="orange.400" />
            <Heading size="sm" color="vrv.700">PAN Card</Heading>
          </HStack>
          <VStack align="start" spacing={2}>
            <Box w="full">
              <Text fontSize="xs" color="gray.400" fontWeight="600" textTransform="uppercase" mb={0.5}>PAN Number</Text>
              <Text fontSize="sm" fontWeight="600" letterSpacing="wider" color="gray.700">{profile?.pan_card_number || '—'}</Text>
            </Box>
            <Box w="full">
              <Text fontSize="xs" color="gray.400" fontWeight="600" textTransform="uppercase" mb={0.5}>Attachment</Text>
              {profile?.pan_card_attachment ? (
                <HStack>
                  <Icon as={DocumentIcon} boxSize={4} color="orange.400" />
                  <Text fontSize="sm" color="gray.600" noOfLines={1}>{profile.pan_card_attachment}</Text>
                  <AttachmentPreview employee_id={empId} type="pan" label="PAN card" />
                </HStack>
              ) : <Text fontSize="sm" color="gray.300">Not uploaded</Text>}
            </Box>
          </VStack>
        </Box>

        {/* Aadhar Card */}
        <Box {...sectionCard(null)}>
          <HStack mb={4}>
            <Icon as={CreditCardIcon} boxSize={5} color="blue.400" />
            <Heading size="sm" color="vrv.700">Aadhar Card</Heading>
          </HStack>
          <VStack align="start" spacing={2}>
            <Box w="full">
              <Text fontSize="xs" color="gray.400" fontWeight="600" textTransform="uppercase" mb={0.5}>Aadhar Number</Text>
              <Text fontSize="sm" fontWeight="600" letterSpacing="wider" color="gray.700">{profile?.aadhar_card_number || '—'}</Text>
            </Box>
            <Box w="full">
              <Text fontSize="xs" color="gray.400" fontWeight="600" textTransform="uppercase" mb={0.5}>Attachment</Text>
              {profile?.aadhar_card_attachment ? (
                <HStack>
                  <Icon as={DocumentIcon} boxSize={4} color="blue.400" />
                  <Text fontSize="sm" color="gray.600" noOfLines={1}>{profile.aadhar_card_attachment}</Text>
                  <AttachmentPreview employee_id={empId} type="aadhar" label="Aadhar card" />
                </HStack>
              ) : <Text fontSize="sm" color="gray.300">Not uploaded</Text>}
            </Box>
          </VStack>
        </Box>

        {/* Cancel Cheque */}
        <Box {...sectionCard(null)}>
          <HStack mb={4}>
            <Icon as={BanknotesIcon} boxSize={5} color="green.400" />
            <Heading size="sm" color="vrv.700">Cancel Cheque</Heading>
          </HStack>
          <VStack align="start" spacing={2}>
            <Box w="full">
              <Text fontSize="xs" color="gray.400" fontWeight="600" textTransform="uppercase" mb={0.5}>Attachment</Text>
              {profile?.cancel_cheque_copy ? (
                <HStack>
                  <Icon as={DocumentIcon} boxSize={4} color="green.400" />
                  <Text fontSize="sm" color="gray.600" noOfLines={1}>{profile.cancel_cheque_copy}</Text>
                  <AttachmentPreview employee_id={empId} type="cheque" label="Cancel cheque" />
                </HStack>
              ) : <Text fontSize="sm" color="gray.300">Not uploaded</Text>}
            </Box>
          </VStack>
        </Box>
      </SimpleGrid>
    </Box>
  )
}

// ─── EditModal ────────────────────────────────────────────────────────────────
function EditModal({ isOpen, onClose, profile, onSaved }) {
  const toast = useToast()
  const empId = profile?.employee_id
  const [form, setForm] = useState({})
  const [panFile, setPanFile] = useState(null)
  const [aadharFile, setAadharFile] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [chequeFile, setChequeFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploadingPan, setUploadingPan] = useState(false)
  const [uploadingAadhar, setUploadingAadhar] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingCheque, setUploadingCheque] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || '',
        designation: profile.designation || '',
        reporting_manager: profile.reporting_manager || '',
        email: profile.email || '',
        mobile: profile.mobile || '',
        pan_card_number: profile.pan_card_number || '',
        aadhar_card_number: profile.aadhar_card_number || '',
        gst_number: profile.gst_number || '',
        company_name: profile.company_name || '',
        address: profile.address || '',
        workload: profile.workload || '',
      })
    }
  }, [profile, isOpen])

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSaveText = async () => {
    setSaving(true)
    try {
      const result = await facultyProfileService.updateProfile(empId, form)
      toast({ title: 'Profile updated', status: 'success', duration: 3000, isClosable: true })
      onSaved(result.faculty)
    } catch (err) {
      toast({ title: 'Update failed', description: err.response?.data?.message || err.message, status: 'error', duration: 4000, isClosable: true })
    } finally { setSaving(false) }
  }

  const handleUploadPan = async () => {
    if (!panFile) return
    setUploadingPan(true)
    try {
      const result = await facultyProfileService.uploadPanCard(empId, panFile, form.pan_card_number)
      toast({ title: 'PAN card uploaded', status: 'success', duration: 3000, isClosable: true })
      onSaved({ pan_card_attachment: result.pan_card_attachment })
      setPanFile(null)
    } catch (err) {
      toast({ title: 'PAN upload failed', description: err.response?.data?.message || err.message, status: 'error', duration: 4000, isClosable: true })
    } finally { setUploadingPan(false) }
  }

  const handleUploadAadhar = async () => {
    if (!aadharFile) return
    setUploadingAadhar(true)
    try {
      const result = await facultyProfileService.uploadAadharCard(empId, aadharFile, form.aadhar_card_number)
      toast({ title: 'Aadhar card uploaded', status: 'success', duration: 3000, isClosable: true })
      onSaved({ aadhar_card_attachment: result.aadhar_card_attachment })
      setAadharFile(null)
    } catch (err) {
      toast({ title: 'Aadhar upload failed', description: err.response?.data?.message || err.message, status: 'error', duration: 4000, isClosable: true })
    } finally { setUploadingAadhar(false) }
  }

  const handleUploadPhoto = async () => {
    if (!photoFile) return
    setUploadingPhoto(true)
    try {
      const result = await facultyProfileService.uploadSelfPhoto(empId, photoFile)
      toast({ title: 'Photo uploaded', status: 'success', duration: 3000, isClosable: true })
      onSaved({ self_photo: result.self_photo })
      setPhotoFile(null)
    } catch (err) {
      toast({ title: 'Photo upload failed', description: err.response?.data?.message || err.message, status: 'error', duration: 4000, isClosable: true })
    } finally { setUploadingPhoto(false) }
  }

  const handleUploadCheque = async () => {
    if (!chequeFile) return
    setUploadingCheque(true)
    try {
      const result = await facultyProfileService.uploadCancelCheque(empId, chequeFile)
      toast({ title: 'Cheque uploaded', status: 'success', duration: 3000, isClosable: true })
      onSaved({ cancel_cheque_copy: result.cancel_cheque_copy })
      setChequeFile(null)
    } catch (err) {
      toast({ title: 'Cheque upload failed', description: err.response?.data?.message || err.message, status: 'error', duration: 4000, isClosable: true })
    } finally { setUploadingCheque(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.400" backdropFilter="blur(4px)" />
      <ModalContent borderRadius="2xl" fontFamily="'Space Grotesk', sans-serif">
        <ModalHeader
          bgGradient="linear(135deg, #304945 0%, #5c837e 100%)"
          color="white"
          borderTopRadius="2xl"
          py={4}
          px={6}
        >
          Edit Profile — {profile?.name}
        </ModalHeader>
        <ModalCloseButton color="white" top={3} />
        <ModalBody py={6} px={6}>
          <VStack spacing={6} align="stretch">
            {/* Basic Info */}
            <Box>
              <HStack mb={3}>
                <Icon as={UserIcon} boxSize={4} color="vrv.500" />
                <Text fontWeight="700" fontSize="sm" textTransform="uppercase" color="vrv.600" letterSpacing="wide">Basic Information</Text>
              </HStack>
              <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                {[
                  ['name', 'Full Name', 'text'],
                  ['designation', 'Designation', 'text'],
                  ['reporting_manager', 'Reporting Manager', 'text'],
                  ['email', 'Email', 'email'],
                  ['mobile', 'Mobile', 'tel'],
                  ['address', 'Address', 'text'],
                  ['company_name', 'Company Name', 'text'],
                  ['gst_number', 'GST Number', 'text'],
                  ['workload', 'Workload', 'number'],
                ].map(([field, label, type]) => (
                  <FormControl key={field}>
                    <FormLabel fontSize="xs" color="gray.500" mb={1}>{label}</FormLabel>
                    <Input
                      size="sm"
                      type={type}
                      value={form[field] || ''}
                      onChange={handleChange(field)}
                      borderRadius="lg"
                      focusBorderColor="vrv.400"
                    />
                  </FormControl>
                ))}
              </SimpleGrid>
              <Button
                mt={4}
                size="sm"
                colorScheme="vrv"
                isLoading={saving}
                onClick={handleSaveText}
              >
                Save Changes
              </Button>
            </Box>

            <Divider />

            {/* Photo */}
            <Box>
              <HStack mb={3}>
                <Icon as={CameraIcon} boxSize={4} color="vrv.500" />
                <Text fontWeight="700" fontSize="sm" textTransform="uppercase" color="vrv.600" letterSpacing="wide">Profile Photo</Text>
              </HStack>
              <HStack>
                <UploadButton
                  label="Upload Photo"
                  accept="image/jpeg,image/jpg,image/png"
                  onFileSelected={setPhotoFile}
                  isLoading={uploadingPhoto}
                  currentFile={photoFile?.name}
                  colorScheme="vrv"
                />
                {photoFile && (
                  <Button size="sm" colorScheme="vrv" onClick={handleUploadPhoto} isLoading={uploadingPhoto}>
                    Save Photo
                  </Button>
                )}
              </HStack>
            </Box>

            <Divider />

            {/* PAN Card */}
            <Box>
              <HStack mb={3}>
                <Icon as={CreditCardIcon} boxSize={4} color="orange.400" />
                <Text fontWeight="700" fontSize="sm" textTransform="uppercase" color="vrv.600" letterSpacing="wide">PAN Card</Text>
              </HStack>
              <VStack align="start" spacing={3}>
                <FormControl maxW="xs">
                  <FormLabel fontSize="xs" color="gray.500" mb={1}>PAN Number</FormLabel>
                  <Input
                    size="sm"
                    value={form.pan_card_number || ''}
                    onChange={handleChange('pan_card_number')}
                    placeholder="ABCDE1234F"
                    textTransform="uppercase"
                    borderRadius="lg"
                    focusBorderColor="orange.400"
                  />
                </FormControl>
                <HStack>
                  <UploadButton
                    label="Upload PAN Attachment"
                    accept=".pdf,image/jpeg,image/jpg,image/png"
                    onFileSelected={setPanFile}
                    isLoading={uploadingPan}
                    currentFile={panFile?.name}
                    colorScheme="orange"
                  />
                  {panFile && (
                    <Button size="sm" colorScheme="orange" onClick={handleUploadPan} isLoading={uploadingPan}>
                      Save PAN
                    </Button>
                  )}
                </HStack>
              </VStack>
            </Box>

            <Divider />

            {/* Aadhar Card */}
            <Box>
              <HStack mb={3}>
                <Icon as={CreditCardIcon} boxSize={4} color="blue.400" />
                <Text fontWeight="700" fontSize="sm" textTransform="uppercase" color="vrv.600" letterSpacing="wide">Aadhar Card</Text>
              </HStack>
              <VStack align="start" spacing={3}>
                <FormControl maxW="xs">
                  <FormLabel fontSize="xs" color="gray.500" mb={1}>Aadhar Number</FormLabel>
                  <Input
                    size="sm"
                    value={form.aadhar_card_number || ''}
                    onChange={handleChange('aadhar_card_number')}
                    placeholder="1234 5678 9012"
                    borderRadius="lg"
                    focusBorderColor="blue.400"
                  />
                </FormControl>
                <HStack>
                  <UploadButton
                    label="Upload Aadhar Attachment"
                    accept=".pdf,image/jpeg,image/jpg,image/png"
                    onFileSelected={setAadharFile}
                    isLoading={uploadingAadhar}
                    currentFile={aadharFile?.name}
                    colorScheme="blue"
                  />
                  {aadharFile && (
                    <Button size="sm" colorScheme="blue" onClick={handleUploadAadhar} isLoading={uploadingAadhar}>
                      Save Aadhar
                    </Button>
                  )}
                </HStack>
              </VStack>
            </Box>

            <Divider />

            {/* Cancel Cheque */}
            <Box>
              <HStack mb={3}>
                <Icon as={BanknotesIcon} boxSize={4} color="green.400" />
                <Text fontWeight="700" fontSize="sm" textTransform="uppercase" color="vrv.600" letterSpacing="wide">Cancel Cheque</Text>
              </HStack>
              <HStack>
                <UploadButton
                  label="Upload Cancel Cheque"
                  accept=".pdf,image/jpeg,image/jpg,image/png"
                  onFileSelected={setChequeFile}
                  isLoading={uploadingCheque}
                  currentFile={chequeFile?.name}
                  colorScheme="green"
                />
                {chequeFile && (
                  <Button size="sm" colorScheme="green" onClick={handleUploadCheque} isLoading={uploadingCheque}>
                    Save Cheque
                  </Button>
                )}
              </HStack>
            </Box>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

// ─── AdminListView ────────────────────────────────────────────────────────────
function AdminListView({ onSelectProfile }) {
  const [profiles, setProfiles] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const fetchProfiles = useCallback(async (p = 1, s = '') => {
    setLoading(true)
    try {
      const res = await facultyProfileService.getAllProfiles(p, 50, s)
      setProfiles(res.data || [])
      setTotal(res.total || 0)
      setPage(p)
    } catch (err) {
      toast({ title: 'Error loading profiles', status: 'error', duration: 3000, isClosable: true })
    } finally { setLoading(false) }
  }, [toast])

  useEffect(() => { fetchProfiles(1, '') }, [fetchProfiles])

  const handleSearch = (e) => {
    setSearch(e.target.value)
    fetchProfiles(1, e.target.value)
  }

  return (
    <Box>
      <Flex mb={4} gap={3} align="center">
        <InputGroup size="sm" maxW="xs">
          <InputLeftElement pointerEvents="none">
            <Icon as={MagnifyingGlassIcon} boxSize={4} color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search by name, ID or email…"
            value={search}
            onChange={handleSearch}
            borderRadius="lg"
            focusBorderColor="vrv.400"
          />
        </InputGroup>
        <Text fontSize="sm" color="gray.500" ml="auto">{total} records</Text>
      </Flex>

      {loading ? (
        <Center py={12}><Spinner size="lg" color="vrv.500" /></Center>
      ) : (
        <Box bg="white" borderRadius="xl" boxShadow="sm" border="1px solid" borderColor="gray.100" overflow="hidden">
          <TableContainer>
            <Table size="sm" variant="simple">
              <Thead bg="gray.50">
                <Tr>
                  {['Employee ID', 'Name', 'Designation', 'Type', 'School', 'Department', 'Email', 'PAN', 'Aadhar', 'Cheque', ''].map((h) => (
                    <Th key={h} color="gray.500" fontSize="xs" fontFamily="'Space Grotesk', sans-serif">{h}</Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {profiles.map((p) => (
                  <Tr key={p.id} _hover={{ bg: 'vrv.50' }} cursor="pointer" onClick={() => onSelectProfile(p)}>
                    <Td fontSize="xs" fontWeight="600" color="vrv.600">{p.employee_id}</Td>
                    <Td fontSize="sm">{p.name}</Td>
                    <Td fontSize="xs" color="gray.600">{p.designation}</Td>
                    <Td>
                      {p.regular_visiting && (
                        <Badge
                          colorScheme={p.regular_visiting.toLowerCase().includes('visit') ? 'orange' : 'green'}
                          borderRadius="full" px={2} fontSize="xs"
                        >
                          {p.regular_visiting}
                        </Badge>
                      )}
                    </Td>
                    <Td fontSize="xs">{p.school?.name || '—'}</Td>
                    <Td fontSize="xs">{p.department?.name || '—'}</Td>
                    <Td fontSize="xs">{p.email || '—'}</Td>
                    <Td>
                      {p.pan_card_attachment
                        ? <Icon as={CheckCircleIcon} boxSize={4} color="green.400" />
                        : <Text fontSize="xs" color="gray.300">—</Text>}
                    </Td>
                    <Td>
                      {p.aadhar_card_attachment
                        ? <Icon as={CheckCircleIcon} boxSize={4} color="green.400" />
                        : <Text fontSize="xs" color="gray.300">—</Text>}
                    </Td>
                    <Td>
                      {p.cancel_cheque_copy
                        ? <Icon as={CheckCircleIcon} boxSize={4} color="green.400" />
                        : <Text fontSize="xs" color="gray.300">—</Text>}
                    </Td>
                    <Td>
                      <Button size="xs" colorScheme="vrv" variant="ghost" onClick={(e) => { e.stopPropagation(); onSelectProfile(p) }}>
                        View
                      </Button>
                    </Td>
                  </Tr>
                ))}
                {profiles.length === 0 && (
                  <Tr><Td colSpan={11} textAlign="center" py={8} color="gray.400">No records found</Td></Tr>
                )}
              </Tbody>
            </Table>
          </TableContainer>
          {/* Pagination */}
          {total > 50 && (
            <Flex p={3} justify="flex-end" gap={2}>
              <Button size="xs" isDisabled={page === 1} onClick={() => fetchProfiles(page - 1, search)}>Prev</Button>
              <Button size="xs" isDisabled={profiles.length < 50} onClick={() => fetchProfiles(page + 1, search)}>Next</Button>
            </Flex>
          )}
        </Box>
      )}
    </Box>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FacultyProfile() {
  const role = userRole()
  const isAdmin = role === 'admin' || role === 'AdminLite'
  const empId = userEmployeeId()
  const toast = useToast()

  const { isOpen, onOpen, onClose } = useDisclosure()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState(isAdmin ? 'list' : 'profile') // 'list' | 'profile'

  // Load profile (for visiting faculty, auto-load own profile)
  const loadProfile = useCallback(async (id) => {
    if (!id) return
    setLoading(true)
    try {
      const data = await facultyProfileService.getProfile(id)
      setProfile(data)
      setView('profile')
    } catch (err) {
      toast({
        title: 'Error loading profile',
        description: err.response?.data?.message || err.message,
        status: 'error', duration: 4000, isClosable: true,
      })
    } finally { setLoading(false) }
  }, [toast])

  useEffect(() => {
    if (!isAdmin && empId) loadProfile(empId)
  }, [isAdmin, empId, loadProfile])

  const handleSaved = (patch) => {
    setProfile((prev) => ({ ...prev, ...patch }))
  }

  return (
    <Box minH="100vh" bg="gray.50" p={{ base: 4, md: 6 }} fontFamily="'Space Grotesk', sans-serif">
      {/* Page header */}
      <Flex mb={6} align="center" gap={3} flexWrap="wrap">
        <Box>
          <Heading size="md" color="vrv.700" fontFamily="'Space Grotesk', sans-serif">
            Faculty Profile
          </Heading>
          <Text fontSize="sm" color="gray.500" mt={0.5}>
            {isAdmin ? 'View and manage visiting faculty profiles' : 'Your visiting faculty profile'}
          </Text>
        </Box>
        {isAdmin && (
          <HStack ml="auto" gap={2}>
            <Button
              size="sm"
              variant={view === 'list' ? 'solid' : 'outline'}
              colorScheme="vrv"
              onClick={() => setView('list')}
            >
              All Profiles
            </Button>
            {profile && (
              <Button
                size="sm"
                variant={view === 'profile' ? 'solid' : 'outline'}
                colorScheme="vrv"
                onClick={() => setView('profile')}
              >
                {profile.name}
              </Button>
            )}
          </HStack>
        )}
      </Flex>

      {loading ? (
        <Center py={16}><Spinner size="xl" color="vrv.500" thickness="4px" /></Center>
      ) : (
        <>
          {view === 'list' && isAdmin && (
            <AdminListView onSelectProfile={(p) => loadProfile(p.employee_id)} />
          )}
          {view === 'profile' && profile && (
            <ProfileView
              profile={profile}
              isAdmin={isAdmin}
              onEdit={onOpen}
            />
          )}
          {view === 'profile' && !profile && !loading && (
            <Center py={16}>
              <VStack spacing={3} color="gray.400">
                <Icon as={UserIcon} boxSize={12} />
                <Text>No profile found</Text>
              </VStack>
            </Center>
          )}
        </>
      )}

      {/* Edit Modal */}
      {profile && (
        <EditModal
          isOpen={isOpen}
          onClose={onClose}
          profile={profile}
          onSaved={handleSaved}
        />
      )}
    </Box>
  )
}
