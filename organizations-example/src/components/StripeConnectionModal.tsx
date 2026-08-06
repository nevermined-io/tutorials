import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createStripeAccount } from '../services/nevermined-api';
import type { WalletResult } from '@/types/api';


interface StripeConnectionModalProps {
  onClose: () => void;
  walletResult: WalletResult;
  userEmail: string;
  userCountryCode: string;
}

export default function StripeConnectionModal({ onClose, walletResult, userEmail, userCountryCode }: StripeConnectionModalProps) {
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const connectToStripe = async () => {
      if (!userEmail || !userCountryCode) {
        return;
      }

      // Create a new AbortController for this operation
      abortControllerRef.current = new AbortController();

      try {
        const stripeResponse = await createStripeAccount({
          userEmail: userEmail,
          userCountryCode: userCountryCode?.toUpperCase(),
          walletResult: walletResult,
        });

        // Check if the operation was cancelled before redirecting
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        window.location.replace(stripeResponse.stripeAccountLink);
      } catch (error) {
        // Only show error if the operation wasn't cancelled
        if (!abortControllerRef.current?.signal.aborted) {
          console.error('Error connecting to Stripe:', error);
        }
      }
    };

    connectToStripe();
  }, [userEmail, userCountryCode]);

  const handleClose = () => {
    // Abort the current operation if it's running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    onClose();
  };


  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent className="p-8 text-center sm:max-w-md">

        {/* Title */}
        <DialogTitle className="font-semibold text-gray-900">Connecting to Stripe</DialogTitle>

        {/* Description */}
        <p className="mb-2 leading-relaxed text-gray-600">
          You'll be redirected to Stripe to
          <br />
          complete the connection process
        </p>

        {/* Loading Spinner */}
        <div className="mb-2">
          <LoaderCircle className="mx-auto h-12 w-12 animate-spin text-gray-400" />
        </div>

        {/* Cancel Button */}
        <div className="flex justify-center">
          <button onClick={handleClose} className="w-[250px]">
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
