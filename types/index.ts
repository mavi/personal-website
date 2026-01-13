export interface Social {
    platform: string;
    url: string;
}

export interface ProfileData {
    name: string;
    role: string;
    views: number;
    bio: string;
    avatarUrl: string;
    socials: Social[];
    theme?: {
        color: string;
    };
}
