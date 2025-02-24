import { useState, useRef, useEffect } from 'react';
import { StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { View, Text } from '@/components/Themed';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { auth, AuthError } from '../../server/services/auth';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const isMounted = useRef(true);
    const { signIn } = useAuth();

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Missing Information', 'Please fill in all fields');
            return;
        }

        setIsLoading(true);
        try {
            const response = await auth.login({ email, password });
            
            if (isMounted.current) {
                // Use the AuthContext's signIn method
                await signIn(response.token, response.user);
                // The navigation will be handled by AuthContext
            }
        } catch (error) {
            if (isMounted.current) {
                if (error instanceof AuthError) {
                    if (error.message === 'Account not found') {
                        Alert.alert('Login Failed', 'Account not found');
                    } else if (error.message === 'Incorrect password') {
                        Alert.alert('Login Failed', 'Incorrect password');
                    } else {
                        Alert.alert('Login Failed', 'Invalid email or password');
                    }
                } else {
                    Alert.alert('Error', 'Something went wrong. Please try again.');
                }
            }
        } finally {
            if (isMounted.current) {
                setIsLoading(false);
            }
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>MindMate</Text>
                    <Text style={styles.subtitle}>Welcome back</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <FontAwesome name="envelope" size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            editable={!isLoading}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <FontAwesome name="lock" size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            editable={!isLoading}
                        />
                    </View>

                    <Pressable style={styles.forgotPassword}>
                        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                    </Pressable>

                    <Pressable
                        style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                        onPress={handleLogin}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.loginButtonText}>Log In</Text>
                        )}
                    </Pressable>

                    <Pressable
                        style={styles.signupButton}
                        onPress={() => router.push('/signup')}
                        disabled={isLoading}
                    >
                        <Text style={styles.signupButtonText}>
                            Don't have an account? Sign Up
                        </Text>
                    </Pressable>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    loginButtonDisabled: {
        opacity: 0.7,
    },
    container: {
        flex: 1,
        backgroundColor: '#F5F6FA',
    },
    content: {
        flex: 1,
        padding: 16,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 18,
        color: '#666',
    },
    form: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F6FA',
        borderRadius: 8,
        marginBottom: 16,
        padding: 12,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#000',
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: 24,
    },
    forgotPasswordText: {
        color: '#2196F3',
        fontSize: 14,
    },
    loginButton: {
        backgroundColor: '#2196F3',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 16,
    },
    loginButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    signupButton: {
        alignItems: 'center',
    },
    signupButtonText: {
        color: '#2196F3',
        fontSize: 14,
    },
});