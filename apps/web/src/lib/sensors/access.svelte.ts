import { hasMotionSensors, requestSensorPermission, sensorsNeedPermission } from './device';

/** Whether this page may read the phone's motion sensors right now. */
class SensorAccess {
	/** iOS: granted after the player tapped "enable" this visit. Elsewhere: always. */
	granted = $state(false);

	get available(): boolean {
		return hasMotionSensors();
	}

	get needsPermission(): boolean {
		return this.available && sensorsNeedPermission();
	}

	/** Call once in the browser. */
	init(): void {
		this.granted = this.available && !sensorsNeedPermission();
	}

	/** From a tap (iOS requirement). */
	async request(): Promise<boolean> {
		this.granted = sensorsNeedPermission() ? await requestSensorPermission() : this.available;
		return this.granted;
	}
}

export const sensorAccess = new SensorAccess();
