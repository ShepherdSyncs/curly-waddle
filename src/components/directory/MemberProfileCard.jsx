import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart } from 'lucide-react';

export default function MemberProfileCard({ profile, isOwn, onClick }) {
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-4 mb-3">
          {profile.profile_photo_url ? (
            <img src={profile.profile_photo_url} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary flex-shrink-0">
              {profile.display_name?.[0] || '?'}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold truncate">{profile.display_name}</p>
              {isOwn && <Badge variant="outline" className="text-xs shrink-0">You</Badge>}
            </div>
            {profile.prayer_partner && (
              <p className="text-xs text-rose-500 flex items-center gap-1 mt-0.5">
                <Heart className="w-3 h-3" /> Prayer Partner
              </p>
            )}
          </div>
        </div>

        {profile.bio && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{profile.bio}</p>
        )}

        {profile.ministry_roles?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {profile.ministry_roles.slice(0, 3).map(r => (
              <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
            ))}
            {profile.ministry_roles.length > 3 && (
              <Badge variant="secondary" className="text-xs">+{profile.ministry_roles.length - 3}</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}