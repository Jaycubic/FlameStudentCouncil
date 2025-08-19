import React, { useState } from 'react';

import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Stack,
  Alert,
  AlertIcon,
  useColorModeValue,
  Card,
  CardBody,
  Heading,
  Text,
  useToast,
  InputGroup,
  InputRightElement,
  IconButton,
  Image,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

function Login() {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('#293836', '#293836');
  const textColor = useColorModeValue('gray.600', 'gray.400');
  const alertBg = useColorModeValue('vrv.50', 'rgba(48, 73, 69, 0.2)');
  const alertColor = useColorModeValue('vrv.700', 'vrv.200');
  const alertIconColor = useColorModeValue('vrv.500', 'vrv.200');
  const bgGradient = useColorModeValue(
    'linear-gradient(to bottom, #136a8a, #267871)',
    'linear-gradient(to bottom, #485563, #29323c)'
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isVerificationStep, setIsVerificationStep] = useState(false);
  const [is2FAStep, setIs2FAStep] = useState(false);
  const [userId, setUserId] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await authService.login(email, password);
      if (response.message === 'verify') {
        setIsVerificationStep(true);
        setUserId(response.userId);
      } else if (response.message === 'redirect') {
        window.location.href = response.url;
      } else {
        setError(response.message || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err.message);
      setError(err.message || 'An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('https://flamestudentcouncil.in:5050/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code }),
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Server did not return JSON');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error verifying code');
      }

      if (data.message === '2fa_setup' || data.message === '2fa_required') {
        setIsVerificationStep(false);
        setIs2FAStep(true);
      } else if (data.message === 'redirect') {
        window.location.href = data.url;
      } else if (data.message === 'success') {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        toast({ title: 'Login Successful', status: 'success', duration: 3000 });
        navigate('/');
      } else {
        setError(data.message || 'Invalid verification code');
      }
    } catch (err) {
      console.error('Verification error:', err.message);
      setError(err.message || 'Error verifying code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('https://flamestudentcouncil.in:5050/api/auth/resend-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error resending verification code');
      }

      toast({ title: 'Verification code resent', status: 'success', duration: 3000 });
    } catch (err) {
      console.error('Resend code error:', err.message);
      setError(err.message || 'Error resending verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('https://flamestudentcouncil.in:5050/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code: twoFACode }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error verifying 2FA');
      }

      const data = await response.json();

      if (data.message === 'success') {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        toast({ title: 'Login Successful', status: 'success', duration: 3000 });
        navigate('/');
      } else {
        setError(data.message || 'Invalid 2FA code');
      }
    } catch (err) {
      console.error('2FA verification error:', err.message);
      setError(err.message || 'Error verifying 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter email before Google sign-in');
      return;
    }

    try {
      const response = await authService.login(email);
      if (response.message === 'verify') {
        setIsVerificationStep(true);
        setUserId(response.userId);
      } else if (response.message === 'redirect') {
        window.location.href = response.url;
      } else {
        setError(response.message || 'Google sign-in failed');
      }
    } catch (err) {
      console.error('Google Sign-In error:', err.message);
      setError(err.message || 'Error with Google sign-in');
    }
  };

  return (
    <Box
      h="100vh"
      w="100vw"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg={bgGradient}
      p={4}
    >
      <Card
        bg={bgColor}
        w={{ base: 'full', md: 'md' }}
        maxW="400px"
        boxShadow="xl"
        borderRadius="xl"
        border="1px solid"
        borderColor={borderColor}
        p={6}
      >
        <CardBody>
          <Stack spacing={6}>
            <Box textAlign="center">
              <Image
                src="/Images/FLAME.png"
                alt="FLAME Logo"
                mx="auto"
                mb={4}
                w="100px"
                h="100px"
              />
              <Heading size="lg" mb={2}>
                FLAME STS
              </Heading>
              <Text color={textColor}>Please enter your credentials</Text>
            </Box>

            {error && (
              <Alert status="error" borderRadius="xl">
                <AlertIcon />
                {error}
              </Alert>
            )}

            {!isVerificationStep && !is2FAStep ? (
              <Stack spacing={5}>
                <FormControl isRequired>
                  <FormLabel>Email</FormLabel>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    size="lg"
                    borderRadius="lg"
                    bg={bgColor}
                    borderColor={useColorModeValue('gray.200', 'gray.600')}
                    _hover={{ borderColor: useColorModeValue('vrv.400', 'vrv.300') }}
                    _focus={{
                      borderColor: useColorModeValue('vrv.500', 'vrv.400'),
                      boxShadow: useColorModeValue(
                        '0 0 0 1px var(--chakra-colors-vrv-500)',
                        '0 0 0 1px var(--chakra-colors-vrv-400)'
                      ),
                    }}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Password (Admins only)</FormLabel>
                  <InputGroup size="lg">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      borderRadius="lg"
                      bg={bgColor}
                      borderColor={useColorModeValue('gray.200', 'gray.600')}
                      _hover={{ borderColor: useColorModeValue('vrv.400', 'vrv.300') }}
                      _focus={{
                        borderColor: useColorModeValue('vrv.500', 'vrv.400'),
                        boxShadow: useColorModeValue(
                          '0 0 0 1px var(--chakra-colors-vrv-500)',
                          '0 0 0 1px var(--chakra-colors-vrv-400)'
                        ),
                      }}
                    />
                    <InputRightElement>
                      <IconButton
                        variant="ghost"
                        onClick={() => setShowPassword(!showPassword)}
                        icon={showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        color={useColorModeValue('gray.400', 'gray.500')}
                        _hover={{ bg: 'transparent', color: useColorModeValue('gray.600', 'gray.400') }}
                      />
                    </InputRightElement>
                  </InputGroup>
                </FormControl>

                <Button
                  onClick={handleSubmit}
                  colorScheme="vrv"
                  size="lg"
                  isLoading={isLoading}
                  borderRadius="lg"
                  boxShadow="md"
                  _hover={{ transform: 'translateY(-1px)', boxShadow: 'lg' }}
                  _active={{ transform: 'translateY(0)', boxShadow: 'md' }}
                >
                  Login
                </Button>

                <Button
                  onClick={handleGoogleSignIn}
                  variant="outline"
                  size="lg"
                  bg="white"
                  borderRadius="md"
                  boxShadow="0 2px 8px rgba(0,0,0,0.1)"
                  borderColor="gray.300"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  fontWeight="normal"
                  fontSize="md"
                  px={4}
                  _hover={{ bg: 'gray.50', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}
                  _active={{ bg: 'gray.100' }}
                >
                  <Image
                    src="/Images/Google__G__logo.svg"
                    alt="Google logo"
                    w="20px"
                    h="20px"
                    mr={2}
                  />
                  Sign in with Google
                </Button>
              </Stack>
            ) : isVerificationStep ? (
              <Stack spacing={5}>
                <Text textAlign="center">
                  A verification code has been sent to <strong>{email}</strong>.
                </Text>
                <FormControl isRequired>
                  <FormLabel>Verification Code</FormLabel>
                  <Input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    size="lg"
                    borderRadius="lg"
                    bg={bgColor}
                  />
                </FormControl>
                <Button
                  onClick={handleVerifyCode}
                  colorScheme="vrv"
                  size="lg"
                  isLoading={isLoading}
                  borderRadius="lg"
                >
                  Verify Code
                </Button>
                <Button
                  onClick={handleResendCode}
                  variant="link"
                  colorScheme="vrv"
                  size="sm"
                >
                  Resend Verification Code
                </Button>
              </Stack>
            ) : is2FAStep ? (
              <Stack spacing={5}>
                <Text textAlign="center">Enter your 2FA code</Text>
                <FormControl isRequired>
                  <FormLabel>2FA Code</FormLabel>
                  <Input
                    type="text"
                    value={twoFACode}
                    onChange={(e) => setTwoFACode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    size="lg"
                    borderRadius="lg"
                    bg={bgColor}
                  />
                </FormControl>
                <Button
                  onClick={handleVerify2FA}
                  colorScheme="vrv"
                  size="lg"
                  isLoading={isLoading}
                  borderRadius="lg"
                >
                  Verify 2FA
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </CardBody>
      </Card>
    </Box>
  );
}

export default Login;
