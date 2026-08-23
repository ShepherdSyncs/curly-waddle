import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, Phone, MapPin, Cake, Heart, Edit2, Shield } from 'lucide-react';

export default function MemberDetailDialog({ profile, isOwn, isAdmin, onEdit, onClose }) {
  // Admins see everything regardless of privacy settings
  const canSee = (privacyKey) => isAdmin || profile[privacyKey] !== 'private';
  return (
    <Dialog open={true} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Member Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Avatar + Name */}
          <div className="flex items-center gap-4">
            {profile.profile_photo_url ? (
              <img src={profile.profile_photo_url} alt="" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                {profile.display_name?.[0] || '?'}
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold">{profile.display_name}</h2>
              {profile.prayer_partner && (
                <p className="text-sm text-rose-500 flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5" /> Available for Prayer
                </p>
              )}
              {profile.ministry_roles?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {profile.ministry_roles.map(r => <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>)}
                </div>
              )}
            </div>
          </div>

          {isAdmin && !profile.show_in_directory && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
              <Shield className="w-3.5 h-3.5" /> Hidden from directory — admin view
            </div>
          )}

          {/* Bio */}
          {profile.bio && <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>}

          {/* Contact details (respect privacy) */}
          <div className="space-y-2">
            {canSee('privacy_email') && profile.user_email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <a href={`mailto:${profile.user_email}`} className="text-primary hover:underline">{profile.user_email}</a>
              </div>
            )}
            {canSee('privacy_phone') && profile.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{profile.phone}</span>
              </div>
            )}
            {canSee('privacy_address') && profile.address && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>{profile.address}</span>
              </div>
            )}
            {canSee('privacy_birthday') && profile.birthday && (
              <div className="flex items-center gap-2 text-sm">
                <Cake className="w-4 h-4 text-muted-foreground" />
                <span>{new Date(profile.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
              </div>
            )}
          </div>

          {isOwn && (
            <Button variant="outline" className="w-full gap-2" onClick={onEdit}>
              <Edit2 className="w-4 h-4" /> Edit My Profile
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}