import React from 'react';
import { StyleSheet, Pressable, View } from 'react-native';
import { Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';

// Define the allowed FontAwesome icon names that we'll use
type StatusIconName = 'arrow-up' | 'minus' | 'arrow-down';

interface MentalHealthHistoryCardProps {
  date: string;
  status: 'stable' | 'declining' | 'critical';
  confidenceScore: number;
  notes?: string;
  onPress: () => void;
}

export default function MentalHealthHistoryCard({
  date,
  status,
  confidenceScore,
  notes,
  onPress
}: MentalHealthHistoryCardProps) {
  // Determine status icon and color
  const getStatusIcon = (): { icon: StatusIconName; color: string } => {
    switch(status) {
      case 'stable': return { icon: 'arrow-up', color: '#4CAF50' }; // Green
      case 'declining': return { icon: 'minus', color: '#FFA726' }; // Orange
      case 'critical': return { icon: 'arrow-down', color: '#F44336' }; // Red
      default: return { icon: 'minus', color: '#2196F3' }; // Blue default
    }
  };

  const { icon, color } = getStatusIcon();
  
  // Format time (e.g., "2:30 PM") since we're grouping by day already
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formattedTime = formatTime(date);
  const confidencePercent = Math.round(confidenceScore * 100);

  return (
    <Pressable style={styles.historyCard} onPress={onPress}>
      <View style={styles.historyCardContent}>
        <View style={styles.dateScoreContainer}>
          <Text style={styles.dateText}>{formattedTime}</Text>
          <View style={styles.scoreContainer}>
            <Text style={[styles.scoreText, { color }]}>{confidencePercent}% </Text>
            <FontAwesome name={icon} size={12} color={color} />
          </View>
        </View>
        <Text style={styles.statusText}>Status: <Text style={{ color }}>{status}</Text></Text>
        {notes && <Text style={styles.noteText} numberOfLines={2}>{notes}</Text>}
        <Text style={styles.detailsLink}>View Details</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  historyCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  historyCardContent: {
    gap: 8,
  },
  dateScoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 14,
    color: '#444',
  },
  noteText: {
    fontSize: 14,
    color: '#666',
  },
  detailsLink: {
    fontSize: 14,
    color: '#2196F3',
    alignSelf: 'flex-end',
  },
});