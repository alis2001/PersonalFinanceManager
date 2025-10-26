import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';

interface AlertDialogProps {
  visible: boolean;
  title: string;
  message: string;
  type: 'error' | 'warning' | 'info' | 'success';
  buttons: Array<{
    text: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void;
  }>;
  onClose?: () => void;
}

const AlertDialog: React.FC<AlertDialogProps> = ({
  visible,
  title,
  message,
  type,
  buttons,
  onClose,
}) => {
  const getTypeStyles = () => {
    switch (type) {
      case 'error':
        return {
          headerColor: '#dc2626',
          iconColor: '#dc2626',
          icon: '❌',
        };
      case 'warning':
        return {
          headerColor: '#d97706',
          iconColor: '#d97706',
          icon: '⚠️',
        };
      case 'info':
        return {
          headerColor: '#2563eb',
          iconColor: '#2563eb',
          icon: 'ℹ️',
        };
      case 'success':
        return {
          headerColor: '#16a34a',
          iconColor: '#16a34a',
          icon: '✅',
        };
      default:
        return {
          headerColor: '#1a1a1a',
          iconColor: '#1a1a1a',
          icon: 'ℹ️',
        };
    }
  };

  const typeStyles = getTypeStyles();

  const getButtonStyle = (buttonStyle?: string) => {
    switch (buttonStyle) {
      case 'cancel':
        return [styles.button, styles.cancelButton];
      case 'destructive':
        return [styles.button, styles.destructiveButton];
      default:
        return [styles.button, styles.defaultButton];
    }
  };

  const getButtonTextStyle = (buttonStyle?: string) => {
    switch (buttonStyle) {
      case 'cancel':
        return [styles.buttonText, styles.cancelButtonText];
      case 'destructive':
        return [styles.buttonText, styles.destructiveButtonText];
      default:
        return [styles.buttonText, styles.defaultButtonText];
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: typeStyles.headerColor }]}>
            <View style={styles.headerContent}>
              <Text style={styles.icon}>{typeStyles.icon}</Text>
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.message}>{message}</Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={getButtonStyle(button.style)}
                onPress={() => {
                  if (button.onPress) {
                    button.onPress();
                  }
                  if (onClose) {
                    onClose();
                  }
                }}
              >
                <Text style={getButtonTextStyle(button.style)}>
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden',
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  message: {
    color: '#374151',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'left',
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  defaultButton: {
    backgroundColor: '#1a1a1a',
  },
  cancelButton: {
    backgroundColor: '#6b7280',
  },
  destructiveButton: {
    backgroundColor: '#dc2626',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  defaultButtonText: {
    color: '#ffffff',
  },
  cancelButtonText: {
    color: '#ffffff',
  },
  destructiveButtonText: {
    color: '#ffffff',
  },
});

export default AlertDialog;

