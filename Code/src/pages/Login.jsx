// Login.jsx
import React, { useState, useEffect, useRef } from 'react'; 
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
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import QRCode from 'qrcode';

function Login() {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('#293836', '#293836');
  const textColor = useColorModeValue('gray.600', 'gray.400');
  const alertBg = useColorModeValue('vrv.50', 'rgba(48, 73, 69, 0.2)');
  const alertColor = useColorModeValue('vrv.700', 'vrv.200');
  const alertIconColor = useColorModeValue('vrv.500', 'vrv.200');
  const bgGradient = useColorModeValue(
    'linear-gradient(to bottom, #2f8f83, #1f6fa0, #103d65)', // Light mode: darker teal → ocean blue → navy
    'linear-gradient(to bottom, #3b4654, #2c3440, #1e252e)'  // Dark mode: more muted, subtle grays
  );


  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isVerificationStep, setIsVerificationStep] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState(null);
  const [secret, setSecret] = useState('');
  const [userId, setUserId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [forgotPasswordStep, setForgotPasswordStep] = useState(null);
  const [resetUserId, setResetUserId] = useState(null);
  const [resetToken, setResetToken] = useState(null);
  const [isGoogleVerificationStep, setIsGoogleVerificationStep] = useState(false);
  const [googleUserId, setGoogleUserId] = useState(null);
  const [googleVerificationCode, setGoogleVerificationCode] = useState('');

  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const qrCanvasRef = useRef(null);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const token = query.get('token');
    const user = query.get('user');
    const expiresAt = query.get('expiresAt');
    const errorMsg = query.get('error');
    if (token && user && expiresAt) {
      localStorage.setItem('token', token);
      localStorage.setItem('user', user);
      localStorage.setItem('expiresAt', expiresAt);
      toast({ title: 'Login Successful', status: 'success', duration: 3000 });
      navigate('/');
    } else if (errorMsg) {
      setError(decodeURIComponent(errorMsg));
      setIsProcessing(false);
    } else {
      setIsProcessing(false);
    }
  }, [location, navigate, toast]);

  useEffect(() => {
    if (twoFAStep === 'setup' && secret && qrCanvasRef.current) {
      const otpauthUrl = `otpauth://totp/FLAME%20STS:${email}?secret=${secret}&issuer=FLAME%20STS`;
      QRCode.toCanvas(qrCanvasRef.current, otpauthUrl, { width: 200 }, (error) => {
        if (error) console.error('QR Code generation error:', error);
      });
    }
  }, [twoFAStep, secret, email]);

  if (isProcessing) {
    return <Box textAlign="center">Processing login...</Box>;
  }

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
      } else if (response.message === 'success') {
        localStorage.setItem('token', response.token);
        localStorage.setItem('expiresAt', response.expiresAt);
        localStorage.setItem('user', JSON.stringify(response.user));
        toast({ title: 'Login Successful', status: 'success', duration: 3000 });
        navigate('/');
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
      if (data.message === '2fa_setup') {
        setTwoFAStep('setup');
        setSecret(data.secret);
        setIsVerificationStep(false);
      } else if (data.message === '2fa_required') {
        setTwoFAStep('verify');
        setIsVerificationStep(false);
      } else if (data.message === 'success') {
        localStorage.setItem('token', data.token);
        localStorage.setItem('expiresAt', data.expiresAt);
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

  const handleResendCode = async (resendUserId) => {
    setIsLoading(true);
    try {
      const response = await fetch('https://flamestudentcouncil.in:5050/api/auth/resend-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resendUserId }),
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
      const response = await fetch('https://flamestudentcouncil.in:5050/api/auth/verify-2fa', {
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
        localStorage.setItem('expiresAt', data.expiresAt);
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
    setError('');
    if (!email) {
      setError('Please enter your email first for verification');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('https://flamestudentcouncil.in:5050/api/auth/initiate-google-signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (data.status === 'verify') {
        setIsGoogleVerificationStep(true);
        setGoogleUserId(data.userId);
      } else if (data.status === 'not_found') {
        setError('Email not found. Please contact administrators for registration');
      } else if (data.status === 'role_not_allowed') {
        setError('Your role does not support Google Sign-In. Please use email and password to log in');
      } else {
        setError('An error occurred while initiating Google Sign-In');
      }
    } catch (err) {
      console.error('Initiate Google Sign-In error:', err);
      setError('Error initiating Google Sign-In');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyGoogleSignInCode = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const response = await fetch('https://flamestudentcouncil.in:5050/api/auth/verify-google-signin-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: googleUserId, code: googleVerificationCode }),
      });
      const data = await response.json();
      if (data.status === 'proceed') {
        const googleResponse = await fetch('https://flamestudentcouncil.in:5050/api/auth/google');
        const googleData = await googleResponse.json();
        if (googleData.url) {
          window.location.href = googleData.url;
        } else {
          setError('Failed to initiate Google Sign-In');
        }
      } else {
        setError(data.message || 'Invalid verification code');
      }
    } catch (err) {
      console.error('Verify Google Sign-In code error:', err);
      setError('Error verifying code');
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = (password) => {
    if (password.length < 8) return 'weak';
    if (/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*])/.test(password)) return 'strong';
    if (/^(?=.*[a-zA-Z])(?=.*\d)/.test(password)) return 'medium';
    return 'weak';
  };

  const handleForgotPasswordSubmit = async () => {
    setError('');
    setIsLoading(true);
    try {
      const response = await fetch('https://flamestudentcouncil.in:5050/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (response.ok) {
        setResetUserId(data.userId);
        setForgotPasswordStep('enter_code');
        toast({ title: 'Verification code sent to your email', status: 'success', duration: 3000 });
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error sending verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyResetCode = async () => {
    setError('');
    setIsLoading(true);
    try {
      const response = await fetch('https://flamestudentcouncil.in:5050/api/auth/verify-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await response.json();
      if (response.ok) {
        if (data.message === '2fa_required') {
          setForgotPasswordStep('enter_2fa');
        } else if (data.message === 'proceed_to_reset') {
          setResetToken(data.resetToken);
          setForgotPasswordStep('set_password');
        }
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error verifying code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyReset2FA = async () => {
    setError('');
    setIsLoading(true);
    try {
      const response = await fetch('https://flamestudentcouncil.in:5050/api/auth/verify-reset-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resetUserId, code: twoFACode }),
      });
      const data = await response.json();
      if (response.ok) {
        setResetToken(data.resetToken);
        setForgotPasswordStep('set_password');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error verifying 2FA code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    setIsLoading(true);
    try {
      const response = await fetch('https://flamestudentcouncil.in:5050/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPassword }),
      });
      const data = await response.json();
      if (response.ok) {
        toast({ title: 'Password reset successfully. Please login with your new credentials.', status: 'success', duration: 3000 });
        setForgotPasswordStep(null);
        setEmail('');
        setPassword('');
        setCode('');
        setTwoFACode('');
        setNewPassword('');
        setResetUserId(null);
        setResetToken(null);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error resetting password');
    } finally {
      setIsLoading(false);
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
                STUDENT COUNCIL
              </Heading>
              <Text color={textColor}>Please enter your credentials</Text>
            </Box>
            {error && (
              <Alert status="error" borderRadius="xl">
                <AlertIcon />
                {error}
              </Alert>
            )}
            {!isVerificationStep && !twoFAStep && !forgotPasswordStep && !isGoogleVerificationStep ? (
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
                  <FormLabel>Password</FormLabel>
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
                <Text textAlign="center">
                  <Button
                    variant="link"
                    colorScheme="vrv"
                    onClick={() => setForgotPasswordStep('enter_email')}
                  >
                    Forgot Password?
                  </Button>
                </Text>
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
                  onClick={() => handleResendCode(userId)}
                  variant="link"
                  colorScheme="vrv"
                  size="sm"
                >
                  Resend Verification Code
                </Button>
              </Stack>
            ) : twoFAStep ? (
              <Stack spacing={5}>
                {twoFAStep === 'setup' && (
                  <Box display="flex" flexDirection="column" alignItems="center">
                    <Text>Scan this QR code with your authenticator app</Text>
                    <Box display="flex" justifyContent="center" width="100%">
                      <canvas ref={qrCanvasRef} />
                    </Box>
                  </Box>
                )}
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
            ) : forgotPasswordStep === 'enter_email' ? (
              <Stack spacing={5}>
                <Text textAlign="center">Enter your email to reset your password</Text>
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
                  />
                </FormControl>
                <Button
                  onClick={handleForgotPasswordSubmit}
                  colorScheme="vrv"
                  size="lg"
                  isLoading={isLoading}
                  borderRadius="lg"
                >
                  Send Verification Code
                </Button>
                <Button
                  variant="link"
                  colorScheme="vrv"
                  onClick={() => setForgotPasswordStep(null)}
                >
                  Back to Login
                </Button>
              </Stack>
            ) : forgotPasswordStep === 'enter_code' ? (
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
                  onClick={handleVerifyResetCode}
                  colorScheme="vrv"
                  size="lg"
                  isLoading={isLoading}
                  borderRadius="lg"
                >
                  Verify Code
                </Button>
                <Button
                  variant="link"
                  colorScheme="vrv"
                  onClick={() => setForgotPasswordStep(null)}
                >
                  Back to Login
                </Button>
              </Stack>
            ) : forgotPasswordStep === 'enter_2fa' ? (
              <Stack spacing={5}>
                <Text textAlign="center">Enter your 2FA code to proceed</Text>
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
                  onClick={handleVerifyReset2FA}
                  colorScheme="vrv"
                  size="lg"
                  isLoading={isLoading}
                  borderRadius="lg"
                >
                  Verify 2FA
                </Button>
                <Button
                  variant="link"
                  colorScheme="vrv"
                  onClick={() => setForgotPasswordStep(null)}
                >
                  Back to Login
                </Button>
              </Stack>
            ) : forgotPasswordStep === 'set_password' ? (
              <Stack spacing={5}>
                <Text textAlign="center">Set your new password</Text>
                <FormControl isRequired>
                  <FormLabel>New Password</FormLabel>
                  <InputGroup size="lg">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      borderRadius="lg"
                      bg={bgColor}
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
                  <Text fontSize="sm" color={textColor} mt={2}>
                    Password must be at least 8 characters long and include letters, numbers, and symbols.
                  </Text>
                  {newPassword && (
                    <Text
                      fontSize="sm"
                      color={
                        getPasswordStrength(newPassword) === 'weak'
                          ? 'red.500'
                          : getPasswordStrength(newPassword) === 'medium'
                          ? 'yellow.500'
                          : 'green.500'
                      }
                      mt={1}
                    >
                      Password Strength: {getPasswordStrength(newPassword)}
                    </Text>
                  )}
                </FormControl>
                <Button
                  onClick={handleResetPassword}
                  colorScheme="vrv"
                  size="lg"
                  isLoading={isLoading}
                  borderRadius="lg"
                >
                  Reset Password
                </Button>
                <Button
                  variant="link"
                  colorScheme="vrv"
                  onClick={() => setForgotPasswordStep(null)}
                >
                  Back to Login
                </Button>
              </Stack>
            ) : isGoogleVerificationStep ? (
              <Stack spacing={5}>
                <Text textAlign="center">
                  A verification code has been sent to <strong>{email}</strong>.
                </Text>
                <FormControl isRequired>
                  <FormLabel>Verification Code</FormLabel>
                  <Input
                    type="text"
                    value={googleVerificationCode}
                    onChange={(e) => setGoogleVerificationCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    size="lg"
                    borderRadius="lg"
                    bg={bgColor}
                  />
                </FormControl>
                <Button
                  onClick={handleVerifyGoogleSignInCode}
                  colorScheme="vrv"
                  size="lg"
                  isLoading={isLoading}
                  borderRadius="lg"
                >
                  Verify Code
                </Button>
                <Button
                  onClick={() => handleResendCode(googleUserId)}
                  variant="link"
                  colorScheme="vrv"
                  size="sm"
                >
                  Resend Verification Code
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
