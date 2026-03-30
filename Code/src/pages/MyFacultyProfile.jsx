// src/pages/MyFacultyProfile.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box, Flex, VStack, HStack, Text, Heading, Avatar, Badge, Button,
  Input, FormControl, FormLabel, Divider, useToast,
  Spinner, Center, Icon, Tag, IconButton, Tooltip, SimpleGrid, useColorModeValue,
} from '@chakra-ui/react'
import {
  IdentificationIcon, BuildingOfficeIcon,
  CameraIcon, DocumentIcon, CreditCardIcon, BanknotesIcon,
  ArrowUpTrayIcon, EyeIcon, CheckCircleIcon,
  PencilSquareIcon, XMarkIcon, TrashIcon,
} from '@heroicons/react/24/outline'
import { facultyProfileService } from '../services/facultyProfileService'

// ─── Helpers ────────────────────────────────────────────────────────────────
function useCardStyle() {
  return {
    bg: useColorModeValue('white', 'gray.800'),
    borderRadius: 'xl',
    boxShadow: 'sm',
    border: '1px solid',
    borderColor: useColorModeValue('gray.100', 'gray.700'),
    p: 6,
    position: 'relative',
  }
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

// ─── Section Header with Edit Toggle ─────────────────────────────────────────
function SectionHeader({ title, icon, isEditing, onToggle, onSave, isLoading, color = 'vrv.500' }) {
  const headingColor = useColorModeValue('vrv.700', 'vrv.200')
  const iconEditColor = useColorModeValue('gray.400', 'gray.500')
  const iconEditHoverColor = useColorModeValue('vrv.500', 'vrv.300')
  const iconEditHoverBg = useColorModeValue('vrv.50', 'whiteAlpha.200')

  return (
    <Flex justify="space-between" align="center" mb={4}>
      <HStack>
        <Icon as={icon} boxSize={5} color={color} />
        <Heading size="sm" color={headingColor}>{title}</Heading>
      </HStack>
      <HStack spacing={2}>
        {isEditing ? (
          <>
            <IconButton
              size="sm"
              icon={<Icon as={CheckCircleIcon} />}
              colorScheme="green"
              variant="ghost"
              onClick={onSave}
              isLoading={isLoading}
              aria-label="Save"
            />
            <IconButton
              size="sm"
              icon={<Icon as={XMarkIcon} />}
              colorScheme="red"
              variant="ghost"
              onClick={onToggle}
              isDisabled={isLoading}
              aria-label="Cancel"
            />
          </>
        ) : (
          <IconButton
            size="sm"
            icon={<Icon as={PencilSquareIcon} />}
            variant="ghost"
            color={iconEditColor}
            _hover={{ color: iconEditHoverColor, bg: iconEditHoverBg }}
            onClick={onToggle}
            aria-label="Edit"
          />
        )}
      </HStack>
    </Flex>
  )
}

// ─── Inline Upload Button ────────────────────────────────────────────────────
function InlineUpload({ label, accept, onFileSelected, currentFile, colorScheme = 'vrv' }) {
  const inputRef = useRef(null)
  return (
    <VStack align="start" spacing={1} w="full">
      <HStack>
        <Button
          size="xs"
          leftIcon={<Icon as={ArrowUpTrayIcon} boxSize={3} />}
          colorScheme={colorScheme}
          variant="outline"
          onClick={() => inputRef.current?.click()}
        >
          {currentFile ? 'Change File' : label}
        </Button>
        {currentFile && (
          <Tag size="sm" colorScheme="green" borderRadius="full">
            <Icon as={CheckCircleIcon} boxSize={3} mr={1} />
            <Text fontSize="xs" noOfLines={1} maxW="150px">{currentFile.name}</Text>
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
    </VStack>
  )
}

// ─── Attachment Preview Icon ─────────────────────────────────────────────────
function AttachmentPreview({ type, label }) {
  const [previewing, setPreviewing] = useState(false)
  const url = facultyProfileService.getOwnAttachmentUrl(type)

  const handlePreview = async (e) => {
    e.preventDefault()
    setPreviewing(true)
    try {
      const blobUrl = await facultyProfileService.getFileBlobUrl(url)
      window.open(blobUrl, '_blank')
    } catch (err) {
      console.error('Preview failed', err)
    } finally { setPreviewing(false) }
  }

  return (
    <Tooltip label={`View ${label}`}>
      <IconButton
        onClick={handlePreview}
        isLoading={previewing}
        icon={<Icon as={EyeIcon} />}
        size="xs"
        variant="ghost"
        colorScheme="blue"
        aria-label={`View ${label}`}
      />
    </Tooltip>
  )
}

// ─── Photo Section (Avatar with Overlay) ─────────────────────────────────────
function PhotoSection({ profile, onUpdate }) {
  const toast = useToast()
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const photoUrl = profile?.self_photo ? `${facultyProfileService.getOwnAttachmentUrl('photo')}?t=${profile._ts || Date.now()}` : null

  const handleUpload = async (file) => {
    setUploading(true)
    try {
      const result = await facultyProfileService.uploadOwnAttachment('photo', file)
      toast({ title: 'Photo updated', status: 'success', duration: 2000 })
      // Trigger a reload or update the state with a cache-buster or re-fetch
      onUpdate({ self_photo: result.self_photo, _ts: Date.now() })
    } catch (err) {
      toast({ title: 'Upload failed', status: 'error' })
    } finally { setUploading(false) }
  }

  return (
    <Box position="relative">
      <SecureImage
        url={photoUrl}
        name={profile?.name}
        border="4px solid white"
        boxShadow="xl"
      />
      <IconButton
        position="absolute"
        bottom="4px"
        right="4px"
        size="sm"
        isRound
        colorScheme="vrv"
        icon={uploading ? <Spinner size="xs" /> : <Icon as={CameraIcon} />}
        onClick={() => inputRef.current?.click()}
        aria-label="Upload Photo"
        boxShadow="md"
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]) }}
      />
    </Box>
  )
}

// ─── Employment Details Card ─────────────────────────────────────────────────
function EmploymentCard({ profile, onUpdate }) {
  const cardStyle = useCardStyle()
  const labelColor = useColorModeValue("gray.400", "gray.500")
  const valueColor = useColorModeValue("gray.700", "gray.200")
  const toast = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', mobile: '' })

  useEffect(() => {
    if (profile) setForm({ email: profile.email || '', mobile: profile.mobile || '' })
  }, [profile, isEditing])

  const handleSave = async () => {
    setLoading(true)
    try {
      const result = await facultyProfileService.updateOwnProfile(form)
      toast({ title: 'Employment details updated', status: 'success' })
      onUpdate(result.faculty)
      setIsEditing(false)
    } catch (err) {
      toast({ title: 'Update failed', status: 'error' })
    } finally { setLoading(false) }
  }

  const fields = [
    { label: 'Employee ID', value: profile?.employee_id, editable: false },
    { label: 'Designation', value: profile?.designation, editable: false },
    { label: 'Reporting Manager', value: profile?.reporting_manager, editable: false },
    { label: 'School', value: profile?.school?.name, editable: false },
    { label: 'Department', value: profile?.department?.name, editable: false },
    { label: 'Area', value: profile?.area?.name, editable: false },
    { label: 'Email', value: profile?.email, editable: true, key: 'email', type: 'email' },
    { label: 'Mobile', value: profile?.mobile, editable: true, key: 'mobile', type: 'tel' },
  ]

  return (
    <Box {...cardStyle} gridColumn={{ lg: 'span 2' }}>
      <SectionHeader
        title="Employment Details"
        icon={IdentificationIcon}
        isEditing={isEditing}
        onToggle={() => setIsEditing(!isEditing)}
        onSave={handleSave}
        isLoading={loading}
      />
      <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
        {fields.map((f) => (
          <Box key={f.label} opacity={isEditing && !f.editable ? 0.4 : 1}>
            <Text fontSize="xs" color={labelColor} fontWeight="600" textTransform="uppercase" mb={0.5}>{f.label}</Text>
            {isEditing && f.editable ? (
              <Input
                size="sm"
                type={f.type}
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                focusBorderColor="vrv.400"
                borderRadius="md"
              />
            ) : (
              <Text fontSize="sm" fontWeight="500" color={valueColor}>{f.value || '—'}</Text>
            )}
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  )
}

// ─── Additional Info Card ────────────────────────────────────────────────────
function AdditionalInfoCard({ profile, onUpdate }) {
  const cardStyle = useCardStyle()
  const labelColor = useColorModeValue("gray.400", "gray.500")
  const valueColor = useColorModeValue("gray.700", "gray.200")
  const toast = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ address: '', company_name: '', gst_number: '' })

  useEffect(() => {
    if (profile) setForm({
      address: profile.address || '',
      company_name: profile.company_name || '',
      gst_number: profile.gst_number || '',
    })
  }, [profile, isEditing])

  const handleSave = async () => {
    setLoading(true)
    try {
      const result = await facultyProfileService.updateOwnProfile(form)
      toast({ title: 'Additional info updated', status: 'success' })
      onUpdate(result.faculty)
      setIsEditing(false)
    } catch (err) {
      toast({ title: 'Update failed', status: 'error' })
    } finally { setLoading(false) }
  }

  const fields = [
    { label: 'Address', value: profile?.address, editable: true, key: 'address' },
    { label: 'Company Name', value: profile?.company_name, editable: true, key: 'company_name' },
    { label: 'GST Number', value: profile?.gst_number, editable: true, key: 'gst_number' },
    { label: 'Workload', value: profile?.workload, editable: false },
  ]

  return (
    <Box {...cardStyle}>
      <SectionHeader
        title="Additional Info"
        icon={BuildingOfficeIcon}
        isEditing={isEditing}
        onToggle={() => setIsEditing(!isEditing)}
        onSave={handleSave}
        isLoading={loading}
      />
      <VStack align="stretch" spacing={3}>
        {fields.map((f) => (
          <Box key={f.label} opacity={isEditing && !f.editable ? 0.4 : 1}>
            <Text fontSize="xs" color={labelColor} fontWeight="600" textTransform="uppercase" mb={0.5}>{f.label}</Text>
            {isEditing && f.editable ? (
              <Input
                size="sm"
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                focusBorderColor="vrv.400"
                borderRadius="md"
              />
            ) : (
              <Text fontSize="sm" fontWeight="500" color={valueColor}>{f.value || '—'}</Text>
            )}
          </Box>
        ))}
      </VStack>
    </Box>
  )
}

// ─── Document Card (Generic for PAN/Aadhar/Cheque) ───────────────────────────
function DocumentCard({ type, label, icon, color, profile, onUpdate }) {
  const cardStyle = useCardStyle()
  const labelColor = useColorModeValue("gray.400", "gray.500")
  const valueColor = useColorModeValue("gray.700", "gray.200")
  const fileBg = useColorModeValue("gray.50", "whiteAlpha.100")
  const fileBorder = useColorModeValue("gray.200", "whiteAlpha.300")
  const toast = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState(null)
  const [number, setNumber] = useState('')
  const [markedForDelete, setMarkedForDelete] = useState(false)

  const numKey = type === 'pan' ? 'pan_card_number' : type === 'aadhar' ? 'aadhar_card_number' : null
  const attKey = type === 'pan' ? 'pan_card_attachment' : type === 'aadhar' ? 'aadhar_card_attachment' : 'cancel_cheque_copy'

  useEffect(() => {
    if (profile && numKey) setNumber(profile[numKey] || '')
  }, [profile, numKey, isEditing])

  const handleSave = async () => {
    if (!isEditing) return
    setLoading(true)
    try {
      const extraData = numKey ? { [numKey]: number } : {}
      const result = await facultyProfileService.uploadOwnAttachment(type, file, extraData)
      toast({ title: `${label} updated`, status: 'success' })
      onUpdate({ [attKey]: result[attKey], ...(numKey ? { [numKey]: number } : {}) })
      setIsEditing(false)
      setFile(null)
      setMarkedForDelete(false)
    } catch (err) {
      toast({ title: `Update failed`, status: 'error' })
    } finally { setLoading(false) }
  }

  const existingFile = profile?.[attKey]

  return (
    <Box {...cardStyle}>
      <SectionHeader
        title={label}
        icon={icon}
        color={color}
        isEditing={isEditing}
        onToggle={() => { setIsEditing(!isEditing); setFile(null); setMarkedForDelete(false); }}
        onSave={handleSave}
        isLoading={loading}
      />
      <VStack align="start" spacing={3}>
        {numKey && (
          <Box w="full">
            <Text fontSize="xs" color={labelColor} fontWeight="600" textTransform="uppercase" mb={0.5}>{label} Number</Text>
            {isEditing ? (
              <Input
                size="sm"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                focusBorderColor={color}
              />
            ) : (
              <Text fontSize="sm" fontWeight="600" letterSpacing="wider" color={valueColor}>{profile?.[numKey] || '—'}</Text>
            )}
          </Box>
        )}
        <Box w="full">
          <Text fontSize="xs" color={labelColor} fontWeight="600" textTransform="uppercase" mb={0.5}>Attachment</Text>
          {isEditing ? (
            <VStack align="start" w="full">
              {existingFile && !markedForDelete ? (
                <HStack w="full" bg={fileBg} p={2} borderRadius="md" border="1px dashed" borderColor={fileBorder}>
                  <Icon as={DocumentIcon} color={color} />
                  <Text fontSize="xs" noOfLines={1} flex={1}>{existingFile}</Text>
                  <IconButton
                    size="xs"
                    icon={<Icon as={TrashIcon} />}
                    colorScheme="red"
                    variant="ghost"
                    onClick={() => setMarkedForDelete(true)}
                    aria-label="Remove"
                  />
                </HStack>
              ) : (
                <InlineUpload label={`Upload ${label}`} accept=".pdf,image/*" onFileSelected={setFile} currentFile={file} colorScheme={type === 'pan' ? 'orange' : type === 'aadhar' ? 'blue' : 'green'} />
              )}
            </VStack>
          ) : existingFile ? (
            <HStack>
              <Icon as={DocumentIcon} boxSize={4} color={color} />
              <Text fontSize="xs" color={valueColor} noOfLines={1} flex={1}>{existingFile}</Text>
              <AttachmentPreview type={type} label={label} />
            </HStack>
          ) : (
            <Text fontSize="sm" color="gray.500">Not uploaded</Text>
          )}
        </Box>
      </VStack>
    </Box>
  )
}

// ─── Main MyFacultyProfile Page ──────────────────────────────────────────────
export default function MyFacultyProfile() {
  const bgColor = useColorModeValue("gray.50", "gray.900")
  const headingColor = useColorModeValue("vrv.700", "vrv.200")
  const textColor = useColorModeValue("gray.500", "gray.400")
  const bannerBg = useColorModeValue("#e3f0f8", "#1e3a8a")
  const bannerTextColor = useColorModeValue("black", "white")
  const bannerSubTextColor = useColorModeValue("blackAlpha.800", "whiteAlpha.800")

  const toast = useToast()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    try {
      const data = await facultyProfileService.getOwnProfile()
      setProfile(data)
    } catch (err) {
      toast({ title: 'Error loading profile', status: 'error' })
    } finally { setLoading(false) }
  }, [toast])

  useEffect(() => { loadProfile() }, [loadProfile])

  const handleUpdate = (patch) => {
    setProfile((prev) => ({ ...prev, ...patch }))
  }

  if (loading) return <Center h="100vh"><Spinner size="xl" color="vrv.500" thickness="4px" /></Center>

  if (!profile) return (
    <Center h="100vh">
      <VStack spacing={3} color="gray.400">
        <Icon as={IdentificationIcon} boxSize={12} />
        <Text>No profile found for your login</Text>
      </VStack>
    </Center>
  )

  return (
    <Box minH="100vh" bg={bgColor} p={{ base: 4, md: 6 }} fontFamily="'Space Grotesk', sans-serif">
      <Flex mb={6} align="center" justify="space-between">
        <Box>
          <Heading size="md" color={headingColor} fontFamily="'Space Grotesk', sans-serif">My Faculty Profile</Heading>
          <Text fontSize="sm" color={textColor} mt={0.5}>Manage your personal information and documents</Text>
        </Box>
      </Flex>

      <Box
        bg={bannerBg}
        borderRadius="2xl"
        p={{ base: 6, md: 10 }}
        mb={8}
        position="relative"
        overflow="hidden"
      >
        <Box position="absolute" top="-40px" right="-40px" w="200px" h="200px" borderRadius="full" bg="whiteAlpha.100" />
        <Flex align="center" gap={6} flexWrap="wrap">
          <PhotoSection profile={profile} onUpdate={handleUpdate} />
          <VStack align="start" spacing={1} color={bannerTextColor}>
            <Heading size="lg" fontFamily="'Space Grotesk', sans-serif">{profile?.name || '—'}</Heading>
            <Text fontSize="md" color={bannerSubTextColor}>{profile?.designation || '—'}</Text>
            <HStack mt={1} flexWrap="wrap" gap={2}>
              {profile?.regular_visiting && (
                <Badge colorScheme={profile.regular_visiting.toLowerCase().includes('visit') ? 'orange' : 'green'} borderRadius="full" px={3} py={0.5} fontSize="xs">
                  {profile.regular_visiting}
                </Badge>
              )}
              <Badge bg="whiteAlpha.300" color={bannerTextColor} borderRadius="full" px={3} py={0.5} fontSize="xs">{profile?.employee_id}</Badge>
            </HStack>
          </VStack>
        </Flex>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
        <EmploymentCard profile={profile} onUpdate={handleUpdate} />
        <AdditionalInfoCard profile={profile} onUpdate={handleUpdate} />
        <DocumentCard type="pan" label="PAN Card" icon={CreditCardIcon} color="orange.400" profile={profile} onUpdate={handleUpdate} />
        <DocumentCard type="aadhar" label="Aadhar Card" icon={CreditCardIcon} color="blue.400" profile={profile} onUpdate={handleUpdate} />
        <DocumentCard type="cheque" label="Cancel Cheque" icon={BanknotesIcon} color="green.400" profile={profile} onUpdate={handleUpdate} />
      </SimpleGrid>
    </Box>
  )
}
