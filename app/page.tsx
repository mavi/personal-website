import { ProfileCard } from "@/components/ProfileCard";
import profileData from "@/data/profile.json";
import { ProfileData } from "@/types";

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 md:p-24 overflow-hidden relative bg-black">
            <div className="z-10 w-full max-w-md">
                <ProfileCard data={profileData as ProfileData} />
            </div>
        </main>
    );
}
