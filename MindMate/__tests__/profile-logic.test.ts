// __tests__/profile-logic.test.ts
import { Alert } from 'react-native';
import { profileApi, UserProfile, EmergencyContact } from '@/services/profileApi';
import { mentalHealthApi } from '@/services/mentalHealthApi';
import { useAuth } from '@/contexts/AuthContext';

// Mock dependencies
jest.mock('@/services/profileApi', () => ({
    profileApi: {
        getProfile: jest.fn(),
        updateProfile: jest.fn()
    },
    UserProfile: class { },
    EmergencyContact: class { }
}));

jest.mock('@/services/mentalHealthApi', () => ({
    mentalHealthApi: {
        getAssessmentHistory: jest.fn(),
        getBaselineHistory: jest.fn()
    }
}));

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: jest.fn()
}));

jest.mock('react-native', () => ({
    Alert: { alert: jest.fn() }
}));

describe('Profile Screen Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useAuth as jest.Mock).mockReturnValue({
            user: { id: 'testuser' }
        });
    });

    // Helper function to simulate profile fetching
    const fetchProfile = async () => {
        try {
            const data = await profileApi.getProfile();
            return { profile: data, error: null };
        } catch (error) {
            return {
                profile: null,
                error: error instanceof Error ? error.message : 'Failed to load profile'
            };
        }
    };

    it('fetches profile successfully', async () => {
        const mockProfile = {
            id: 'profile1',
            username: 'testuser',
            email: 'test@example.com',
            phone: '123-456-7890',
            emergencyContact: {
                name: 'Emergency Contact',
                relationship: 'Friend',
                phone: '987-654-3210'
            }
        };

        (profileApi.getProfile as jest.Mock).mockResolvedValueOnce(mockProfile);

        const result = await fetchProfile();

        expect(profileApi.getProfile).toHaveBeenCalled();
        expect(result.profile).toEqual(mockProfile);
        expect(result.error).toBeNull();
    });

    it('handles errors when fetching profile', async () => {
        const errorMessage = 'Network error';
        (profileApi.getProfile as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

        const result = await fetchProfile();

        expect(result.profile).toBeNull();
        expect(result.error).toBe(errorMessage);
    });

    // Helper function to simulate mental health history fetching
    const fetchMentalHealthHistory = async () => {
        try {
            // Fetch regular assessments
            const assessments = await mentalHealthApi.getAssessmentHistory(20);

            // Fetch baseline assessments separately
            const baselines = await mentalHealthApi.getBaselineHistory(5);

            return {
                mentalHealthHistory: assessments,
                baselineHistory: baselines,
                error: null
            };
        } catch (error) {
            return {
                mentalHealthHistory: [],
                baselineHistory: [],
                error: error instanceof Error ? error.message : 'Failed to load mental health history'
            };
        }
    };

    it('fetches mental health history successfully', async () => {
        const mockAssessments = [
            { _id: 'assess1', timestamp: new Date('2023-05-15').toISOString() },
            { _id: 'assess2', timestamp: new Date('2023-05-10').toISOString() }
        ];

        const mockBaselines = [
            { _id: 'baseline1', establishedAt: new Date('2023-05-01').toISOString() }
        ];

        (mentalHealthApi.getAssessmentHistory as jest.Mock).mockResolvedValueOnce(mockAssessments);
        (mentalHealthApi.getBaselineHistory as jest.Mock).mockResolvedValueOnce(mockBaselines);

        const result = await fetchMentalHealthHistory();

        expect(mentalHealthApi.getAssessmentHistory).toHaveBeenCalledWith(20);
        expect(mentalHealthApi.getBaselineHistory).toHaveBeenCalledWith(5);
        expect(result.mentalHealthHistory).toEqual(mockAssessments);
        expect(result.baselineHistory).toEqual(mockBaselines);
        expect(result.error).toBeNull();
    });

    it('handles errors when fetching mental health history', async () => {
        const errorMessage = 'API error';
        (mentalHealthApi.getAssessmentHistory as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

        const result = await fetchMentalHealthHistory();

        expect(result.mentalHealthHistory).toEqual([]);
        expect(result.baselineHistory).toEqual([]);
        expect(result.error).toBe(errorMessage);
    });

    // Helper function to simulate profile field update
    const handleUpdateField = async (field: string, value: string) => {
        try {
            const updateData: any = { [field]: value };
            const updatedProfile = await profileApi.updateProfile(updateData);
            return { profile: updatedProfile, error: null };
        } catch (error) {
            return {
                profile: null,
                error: error instanceof Error ? error.message : 'Failed to update profile'
            };
        }
    };

    it('updates profile field successfully', async () => {
        const mockUpdatedProfile = {
            id: 'profile1',
            username: 'newusername',
            email: 'test@example.com'
        };

        (profileApi.updateProfile as jest.Mock).mockResolvedValueOnce(mockUpdatedProfile);

        const result = await handleUpdateField('username', 'newusername');

        expect(profileApi.updateProfile).toHaveBeenCalledWith({ username: 'newusername' });
        expect(result.profile).toEqual(mockUpdatedProfile);
        expect(result.error).toBeNull();
    });

    it('handles errors when updating profile field', async () => {
        const errorMessage = 'Update failed';
        (profileApi.updateProfile as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

        const result = await handleUpdateField('username', 'newusername');

        expect(result.profile).toBeNull();
        expect(result.error).toBe(errorMessage);
    });

    // Helper function to simulate emergency contact update
    const handleUpdateEmergencyContact = async (contact: EmergencyContact) => {
        try {
            const updatedProfile = await profileApi.updateProfile({
                emergencyContact: contact
            });
            return { profile: updatedProfile, error: null };
        } catch (error) {
            return {
                profile: null,
                error: error instanceof Error ? error.message : 'Failed to update emergency contact'
            };
        }
    };

    it('updates emergency contact successfully', async () => {
        const mockContact = {
            name: 'New Contact',
            relationship: 'Family',
            phone: '555-123-4567'
        };

        const mockUpdatedProfile = {
            id: 'profile1',
            username: 'testuser',
            emergencyContact: mockContact
        };

        (profileApi.updateProfile as jest.Mock).mockResolvedValueOnce(mockUpdatedProfile);

        const result = await handleUpdateEmergencyContact(mockContact);

        expect(profileApi.updateProfile).toHaveBeenCalledWith({
            emergencyContact: mockContact
        });
        expect(result.profile).toEqual(mockUpdatedProfile);
        expect(result.error).toBeNull();
    });

    it('handles errors when updating emergency contact', async () => {
        const errorMessage = 'Update failed';
        const mockContact = {
            name: 'New Contact',
            relationship: 'Family',
            phone: '555-123-4567'
        };

        (profileApi.updateProfile as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

        const result = await handleUpdateEmergencyContact(mockContact);

        expect(result.profile).toBeNull();
        expect(result.error).toBe(errorMessage);
    });

    // Helper function to group assessments by month
    const groupAssessmentsByMonth = (assessments: any[]) => {
        // First group by month
        const byMonth: Record<string, any[]> = {};

        assessments.forEach(assessment => {
            const date = new Date(assessment.timestamp);
            const monthYear = date.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
            });

            if (!byMonth[monthYear]) {
                byMonth[monthYear] = [];
            }

            byMonth[monthYear].push(assessment);
        });

        // Then sort each month's assessments by day (descending order)
        Object.keys(byMonth).forEach(month => {
            byMonth[month].sort((a, b) => {
                const dateA = new Date(a.timestamp);
                const dateB = new Date(b.timestamp);

                // If different days, sort by day
                if (dateA.getDate() !== dateB.getDate()) {
                    return dateB.getDate() - dateA.getDate();
                }

                // If same day, sort by time (most recent first)
                return dateB.getTime() - dateA.getTime();
            });
        });

        return byMonth;
    };

    it('groups assessments by month correctly', () => {
        const mockAssessments = [
            { _id: 'a1', timestamp: new Date('2023-05-15T10:00:00Z').toISOString() },
            { _id: 'a2', timestamp: new Date('2023-05-15T14:00:00Z').toISOString() },
            { _id: 'a3', timestamp: new Date('2023-05-10T09:00:00Z').toISOString() },
            { _id: 'a4', timestamp: new Date('2023-04-20T15:00:00Z').toISOString() }
        ];

        const grouped = groupAssessmentsByMonth(mockAssessments);

        // Should have two month groups
        expect(Object.keys(grouped)).toHaveLength(2);
        expect(Object.keys(grouped)).toContain('May 2023');
        expect(Object.keys(grouped)).toContain('April 2023');

        // May should have 3 entries
        expect(grouped['May 2023']).toHaveLength(3);

        // April should have 1 entry
        expect(grouped['April 2023']).toHaveLength(1);

        // First May entry should be from the 15th (most recent day first)
        expect(new Date(grouped['May 2023'][0].timestamp).getDate()).toBe(15);

        // Within the same day (15th), the 14:00 entry should come before the 10:00 entry
        // Use getUTCHours() to get the hour in UTC to avoid timezone issues
        expect(new Date(grouped['May 2023'][0].timestamp).getUTCHours()).toBe(14);
        expect(new Date(grouped['May 2023'][1].timestamp).getUTCHours()).toBe(10);
    });
});