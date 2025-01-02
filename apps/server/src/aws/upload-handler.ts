import { S3Client, CreateMultipartUploadCommand, CompleteMultipartUploadCommand, PutObjectCommand, UploadPartCommand, ObjectCannedACL } from "@aws-sdk/client-s3";
  import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
  import dotenv from "dotenv";

  dotenv.config();


  console.log(process.env.AWS_ACCESS_KEY_ID);
  console.log(process.env.AWS_SECRET_ACCESS_KEY);
  console.log(process.env.AWS_S3_BUCKET_NAME);
  console.log(process.env.S3_ENDPOINT);

  
  // Initialize AWS S3 client
  const s3Client = new S3Client({
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    endpoint: process.env.S3_ENDPOINT, // Optional, only if you're using a custom S3-compatible service
  });
  
  // Check if API is live
  export const checkAPIStatus = (req, res) => {
    res.status(200).send("API is live! 🎉😎");
  };
  
  // Generate single presigned URL
  export const generateSinglePresignedUrl = async (req, res) => {
    try {
      const { fileName } = req.body;
  
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: fileName,
        expires: 100,
        ACL: ObjectCannedACL.bucket_owner_full_control,
      };
      const url = await getSignedUrl(s3Client, new PutObjectCommand(params), {
        expiresIn: 60, // 60 seconds
      });
  
      res.status(200).json({ url });
    } catch (error) {
      console.error("Error generating single presigned URL:", error);
      res.status(500).json({ error: "Error generating presigned URL" });
    }
  };
  
  // Start multipart upload
  export const startMultipartUpload = async (req, res) => {
    try {
      const { fileName, contentType } = req.body;
  
      const params: {
        Bucket: string;
        Key: string;
        ContentDisposition?: string;
        ContentType?: string;
      } = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: fileName,
      };
  
      if (contentType === "VIDEO") {
        params.ContentDisposition = "inline";
        params.ContentType = "video/mp4";
      }
  
      const command = new CreateMultipartUploadCommand(params);
      const multipart = await s3Client.send(command);
  
      res.json({ uploadId: multipart.UploadId });
    } catch (error) {
      console.error("Error starting multipart upload:", error);
      res.status(500).json({ error: "Error starting multipart upload" });
    }
  };
  
  // Generate presigned URLs for multipart upload
  export const generatePresignedUrls = async (req, res) => {
    try {
      const { fileName, uploadId, partNumbers } = req.body;
  
      const totalParts = Array.from({ length: partNumbers }, (_, i) => i + 1);
      const presignedUrls = await Promise.all(
        totalParts.map(async (partNumber) => {
          const params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: fileName,
            PartNumber: partNumber,
            UploadId: uploadId,
          };
  
          return getSignedUrl(s3Client, new UploadPartCommand(params), {
            expiresIn: 3600 * 3, // 3 hours
          });
        })
      );
  
      res.json({ presignedUrls });
    } catch (error) {
      console.error("Error generating presigned URLs:", error);
      res.status(500).json({ error: "Error generating presigned URLs" });
    }
  };
  
  export const completeMultipartUpload = async (req, res) => {
    try {
      // console.log("Request body:", req.body);
  
      const { fileName, uploadId, parts } = req.body;
  
      // Ensure the `parts` array is sorted by `PartNumber`
      const sortedParts = parts
        .sort((a, b) => a.PartNumber - b.PartNumber) // Sort by PartNumber in ascending order
        .map((part) => ({
          ETag: part.ETag,  // Extract ETag correctly
          PartNumber: part.PartNumber,  // Extract PartNumber correctly
        }));
  
      console.log("Sorted parts:", sortedParts); // Debug sorted parts
  
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: fileName,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: sortedParts, // Use the sorted and mapped parts
        },
      };
  
      console.log("Params for CompleteMultipartUploadCommand:", params);
      const command = new CompleteMultipartUploadCommand(params);
      const data = await s3Client.send(command);
  
      console.log("Response from CompleteMultipartUploadCommand:", data);
      res.status(200).json({ fileData: data });
    } catch (error) {
      console.error("Error completing multipart upload:", error);
      res.status(500).json({ error: "Error completing multipart upload" });
    }
  };
  