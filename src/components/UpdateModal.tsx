import { useState } from '@lynx-js/react';
import { UpdateService, type AppUpdate } from '../services/update';
import './UpdateModal.css';

interface Props {
  update: AppUpdate;
  onDismiss: () => void;
}

export function UpdateModal({ update, onDismiss }: Props) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = () => {
    setIsUpdating(true);
    UpdateService.applyUpdate();
  };

  const formattedNotes = update.releaseNotes
    ? update.releaseNotes.replace(/\\n/g, '\n').replace(/\\r/g, '\r')
    : "Performance improvements and bug fixes.";

  return (
    <view className="UpdateOverlay">
      <view className="UpdateCard">
        <view className="UpdateHeader">
          <view className="UpdateIconContainer">
             <text className="UpdateIcon">🚀</text>
          </view>
          <text className="UpdateTitle">New Update Available</text>
          <text className="UpdateVersion">Version {update.version}</text>
        </view>

        <view className="UpdateBody">
          <text className="UpdateBodyTitle">What's New:</text>
          <scroll-view className="UpdateNotes" scroll-y>
             <text className="NotesText">{formattedNotes}</text>
          </scroll-view>
          
          <text className="UpdateHint">
            The app will reload to apply the latest changes.
          </text>
        </view>

        <view className="UpdateActions">
          <view className="UpdateButton" bindtap={handleUpdate}>
             <text className="UpdateButtonText">
               {isUpdating ? 'Updating...' : 'Update Now'}
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
