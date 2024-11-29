export interface DatadogResponse {
 data: {
   id: string;
   type: string;
   attributes: {
     service: string;
     attributes: {
       level: string;
     };
     message: string;
     timestamp: string;
     tags: string[];
   };
 }[];
}

export interface LogsData {
	id: string;
	service: string;
	message: string;
	timestamp: string;
	level: string;
	tags: string[];
}

export interface DatadogLog {
  id: string;
  attributes: LogsData;
}

export interface GetDatadogArgs {
	cluster: string;
	namespace: string;
}

// Type guard for datadog arguments
export function isValidDatadogArgs(args: any): args is GetDatadogArgs {
	return (
		typeof args === "object" &&
		args !== null &&
		"cluster" in args &&
		typeof args.cluster === "string" &&
		"namespace" &&
		typeof args.namespace === "string"
	);
}

