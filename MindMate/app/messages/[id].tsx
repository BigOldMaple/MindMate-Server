import { useState, useEffect, useRef } from 'react';
import { StyleSheet, TextInput, Pressable, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, ViewStyle, TextStyle } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { chatApi, ChatMessage } from '@/services/chatApi';
import { useAuth } from '@/contexts/AuthContext';
import { websocketService } from '@/services/websocketService';
import { debounce } from 'lodash';
import React from 'react';

// Types and Interfaces
interface Participant {
  id: string; // Added for correct read status comparison
  name: string;
  username: string;
  isVerifiedProfessional: boolean;
}

interface StyleTypes {
  container: ViewStyle;
  loadingContainer: ViewStyle;
  header: ViewStyle;
  headerInfo: ViewStyle;
  headerName: TextStyle;
  headerUsername: TextStyle;
  professionalBadge: ViewStyle;
  professionalBadgeText: TextStyle;
  errorBanner: ViewStyle;
  errorText: TextStyle;
  messagesContainer: ViewStyle;
  messagesContent: ViewStyle;
  messageWrapper: ViewStyle;
  messageContainer: ViewStyle;
  ownMessage: ViewStyle;
  otherMessage: ViewStyle;
  messageText: TextStyle;
  ownMessageText: TextStyle;
  messageTime: TextStyle;
  ownMessageTime: TextStyle;
  dateSeparator: ViewStyle;
  dateSeparatorText: TextStyle;
  inputContainer: ViewStyle;
  input: TextStyle;
  sendButton: ViewStyle;
  sendButtonDisabled: ViewStyle;
  typingIndicator: ViewStyle;
  typingText: TextStyle;
  readStatus: TextStyle;
  messageFooter: ViewStyle;
  messageStatus: ViewStyle;
  statusIcon: TextStyle;
  readStatusText: TextStyle;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const firstLoadRef = useRef(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [isParticipantTyping, setIsParticipantTyping] = useState(false);

  useEffect(() => {
    if (firstLoadRef.current) {
      loadMessages();
      firstLoadRef.current = false;
    }

    let isSubscribed = true;

    const setupWebSocket = async () => {
      try {
        console.log('Setting up WebSocket connection...');
        await websocketService.connect();

        websocketService.onNewMessage((message: ChatMessage) => {
          if (!isSubscribed || message.conversationId !== id) return;

          setMessages(prev => {
            const exists = prev.some(m => m._id === message._id);
            if (exists) return prev;

            const newMessages = [...prev, message].sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);

            return newMessages;
          });

          if (message.senderId._id !== user?.id) {
            websocketService.markMessagesAsRead(id as string, [message._id]);
          }
        });

        websocketService.onUserTyping((data: { conversationId: string; userId: string; isTyping: boolean }) => {
          if (!isSubscribed || data.conversationId !== id || data.userId === user?.id) return;

          setIsParticipantTyping(data.isTyping);
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }

          if (data.isTyping) {
            typingTimeoutRef.current = setTimeout(() => {
              if (isSubscribed) {
                setIsParticipantTyping(false);
              }
            }, 3000);
          }
        });

        websocketService.onMessageRead((data: { conversationId: string; messageIds: string[]; readBy: string; readAt?: string }) => {
          if (!isSubscribed || data.conversationId !== id) return;

          setMessages(prev => prev.map(msg =>
            data.messageIds.includes(msg._id)
              ? {
                  ...msg,
                  readBy: [...(msg.readBy || []), {
                    userId: data.readBy,
                    readAt: data.readAt ? new Date(data.readAt) : new Date()
                  }]
                }
              : msg
          ));
        });

      } catch (error) {
        console.error('WebSocket setup error:', error);
        if (isSubscribed) {
          setError('Failed to establish real-time connection');
        }
      }
    };

    setupWebSocket();

    return () => {
      console.log('Cleaning up WebSocket connection...');
      isSubscribed = false;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      websocketService.cleanup();
    };
  }, [id, user?.id]);

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      const conversations = await chatApi.getConversations();
      const conversation = conversations.find(c => c.id === id);

      if (conversation?.participant) {
        setParticipant({
          id: conversation.participant.id, // Added participant ID
          name: conversation.participant.name,
          username: conversation.participant.username,
          isVerifiedProfessional: conversation.participant.isVerifiedProfessional
        });
      }

      const fetchedMessages = await chatApi.getMessages(id as string);
      const sortedMessages = [...fetchedMessages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      setMessages(sortedMessages);

      await chatApi.markAsRead(id as string);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
      console.error('Error loading messages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedTyping = debounce((isTyping: boolean) => {
    if (websocketService) {
      websocketService.sendTypingStatus(id as string, isTyping);
    }
  }, 500);

  const handleTextInput = (text: string) => {
    setNewMessage(text);
    debouncedTyping(text.length > 0);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return;

    try {
      setIsSending(true);

      const optimisticMessage: ChatMessage = {
        _id: Date.now().toString(),
        conversationId: id as string,
        content: newMessage.trim(),
        contentType: 'text',
        createdAt: new Date(),
        updatedAt: new Date(),
        senderId: {
          _id: user?.id || '',
          username: user?.username || '',
          profile: {
            name: user?.profile?.name || ''
          }
        },
        readBy: []
      };

      setMessages(prev => [...prev, optimisticMessage].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ));

      websocketService.sendMessage(id as string, newMessage.trim());

      setNewMessage('');
      scrollViewRef.current?.scrollToEnd({ animated: true });

      debouncedTyping(false);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setMessages(prev => prev.filter(msg => msg._id !== Date.now().toString()));
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const renderDateSeparator = (date: Date) => (
    <View style={styles.dateSeparator}>
      <Text style={styles.dateSeparatorText}>{formatDate(date)}</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              opacity: pressed ? 0.5 : 1,
              padding: 8,
            })}
          >
            <FontAwesome name="arrow-left" size={20} color="#666" />
          </Pressable>

          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>
              {participant?.name || 'Chat'}
            </Text>
            {participant?.isVerifiedProfessional && (
              <View style={styles.professionalBadge}>
                <FontAwesome name="check-circle" size={12} color="#2196F3" />
                <Text style={styles.professionalBadgeText}>Professional</Text>
              </View>
            )}
            <Text style={styles.headerUsername}>@{participant?.username}</Text>
          </View>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message, index) => {
            const isFirstMessage = index === 0;
            const prevMessage = index > 0 ? messages[index - 1] : null;
            const showDateSeparator = isFirstMessage ||
              (prevMessage && new Date(prevMessage.createdAt).toDateString() !== new Date(message.createdAt).toDateString());

            const isOwnMessage = message.senderId._id === user?.id;
            const isRead = message.readBy?.some(read => read.userId === participant?.id); // Updated to use ID
            const isLastMessage = index === messages.length - 1;

            return (
              <View key={message._id} style={styles.messageWrapper}>
                {showDateSeparator && renderDateSeparator(new Date(message.createdAt))}
                <View style={[
                  styles.messageContainer,
                  isOwnMessage ? styles.ownMessage : styles.otherMessage
                ]}>
                  <Text style={[
                    styles.messageText,
                    isOwnMessage && styles.ownMessageText
                  ]}>
                    {message.content}
                  </Text>
                  <View style={styles.messageFooter}>
                    <Text style={[
                      styles.messageTime,
                      isOwnMessage && styles.ownMessageTime
                    ]}>
                      {formatTime(new Date(message.createdAt))}
                    </Text>
                    {isOwnMessage && (
                      <View style={styles.messageStatus}>
                        {isRead ? (
                          <FontAwesome
                            name="check-circle"
                            size={12}
                            color="rgba(255,255,255,0.8)"
                            style={styles.statusIcon}
                          />
                        ) : (
                          <FontAwesome
                            name="check"
                            size={12}
                            color="rgba(255,255,255,0.8)"
                            style={styles.statusIcon}
                          />
                        )}
                      </View>
                    )}
                  </View>
                </View>
                {isLastMessage && isOwnMessage && isRead && (
                  <Text style={styles.readStatusText}>
                    Read {formatTime(new Date(message.readBy[0].readAt))}
                  </Text>
                )}
              </View>
            );
          })}

          {isParticipantTyping && (
            <View style={styles.typingIndicator}>
              <Text style={styles.typingText}>
                {participant?.name} is typing...
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={newMessage}
            onChangeText={handleTextInput}
            multiline
            maxLength={1000}
            editable={!isSending}
          />
          <Pressable
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!newMessage.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <FontAwesome name="send" size={20} color="white" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create<StyleTypes>({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFD',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 3,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
    backgroundColor: 'transparent',
  },
  headerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  headerUsername: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  professionalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  professionalBadgeText: {
    fontSize: 12,
    color: '#2196F3',
    marginLeft: 4,
    fontWeight: '500',
  },
  errorBanner: {
    backgroundColor: '#FFEFEF',
    padding: 12,
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,59,48,0.1)',
  },
  errorText: {
    color: '#D42F1E',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: 'transparent',
  },
  messageWrapper: {
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  messageContainer: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 20,
    marginBottom: 2,
    backgroundColor: 'transparent',
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#2196F3',
    borderBottomRightRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 15,
    color: '#1A1A1A',
    marginBottom: 4,
    fontWeight: '400',
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  ownMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    color: '#8E8E93',
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.8)',
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 24,
    backgroundColor: 'transparent',
  },
  dateSeparatorText: {
    fontSize: 13,
    color: '#8E8E93',
    backgroundColor: 'rgba(142,142,147,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    overflow: 'hidden',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 3,
  },
  input: {
    flex: 1,
    backgroundColor: '#F6F6F6',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    paddingRight: 48,
    maxHeight: 120,
    fontSize: 15,
    lineHeight: 20,
    color: '#1A1A1A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  sendButton: {
    backgroundColor: '#2196F3',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  sendButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#A8D4F5',
  },
  typingIndicator: {
    padding: 8,
    marginLeft: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: 16,
    alignSelf: 'flex-start',
    maxWidth: '50%',
  },
  typingText: {
    fontSize: 12,
    color: '#2196F3',
    fontStyle: 'italic',
  },
  readStatus: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  messageFooter: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  messageStatus: {
    backgroundColor: 'transparent',
    marginLeft: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginLeft: 2,
  },
  readStatusText: {
    fontSize: 11,
    color: '#8E8E93',
    alignSelf: 'flex-end',
    marginTop: 2,
    marginRight: 4,
    fontStyle: 'italic',
  },
});