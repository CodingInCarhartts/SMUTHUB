import { useState } from '@lynx-js/react';
import { type AppUpdate, UpdateService } from '../services/update';
import './UpdateModal.css';

interface Props {
  update: AppUpdate;
  nativeUrl?: string; // If provided, this is a native APK update
  onDismiss: () => void;
}

export function UpdateModal({ update, nativeUrl, onDismiss }: Props) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = () => {
    setIsUpdating(true);
    if (nativeUrl) {
      UpdateService.installNativeUpdate(nativeUrl);
    } else {
      UpdateService.applyUpdate();
    }
  };

  const formattedNotes = update.releaseNotes
    ? update.releaseNotes.replace(/\\n/g, '\n').replace(/\\r/g, '\r')
    : 'Performance improvements and bug fixes.';

  return (
    <view className="UpdateOverlay">
      <view className="UpdateCard">
        <view className="UpdateHeader">
          <view className="UpdateIconContainer">
            <text className="UpdateIcon">{nativeUrl ? '📦' : '🚀'}</text>
          </view>
          <text className="UpdateTitle">
            {nativeUrl ? 'Native Update Available' : 'New Update Available'}
          </text>
          <text className="UpdateVersion">Version {update.version}</text>
        </view>

        <view className="UpdateBody">
          <text className="UpdateBodyTitle">What's New:</text>
          <scroll-view className="UpdateNotes" scroll-y>
            <text className="NotesText">{formattedNotes}</text>
          </scroll-view>

          <text className="UpdateHint">
            {nativeUrl
              ? 'This is a native app update. Tapping below will download and install the new APK.'
              : 'The app will reload to apply the latest changes.'}
          </text>
        </view>

        <view className="UpdateActions">
          <view className="UpdateButton" bindtap={handleUpdate}>
            <text className="UpdateButtonText">
              {isUpdating
                ? 'Updating...'
                : nativeUrl
                  ? 'Install Update'
                  : 'Update Now'}
            </text>
          </view>

          {!update.isMandatory && !isUpdating && (
            <view className="LaterButton" bindtap={onDismiss}>
              <text className="LaterButtonText">Maybe Later</text>
            </view>
          )}
        </view>
      </view>
    </view>
  );
}
