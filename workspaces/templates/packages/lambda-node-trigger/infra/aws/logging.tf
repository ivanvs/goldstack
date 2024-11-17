# Explicitly create the CloudWatch Log Group for the Lambda
resource "aws_cloudwatch_log_group" "lambda_log_group" {
  name              = "/aws/lambda/${var.lambda_name}"
  retention_in_days = 14
}

locals {
  metric_transformation_name      = "${var.lambda_name}-error-count"
  metric_transformation_namespace = "LambdaErrors"
}


# Create metric filter for ERROR logs
resource "aws_cloudwatch_log_metric_filter" "error_logs" {
  name           = "${var.lambda_name}-error-logs"
  pattern        = "ERROR"
  log_group_name = aws_cloudwatch_log_group.lambda_log_group.name

  metric_transformation {
    name          = local.metric_transformation_name  
    namespace     = local.metric_transformation_namespace 
    value         = "1" # Emitted when metric matches
    default_value = "0" # Emitted when metric does not match
    unit          = "Count"
  }
}

# Create CloudWatch alarm for error metric
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${var.lambda_name}-error-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  datapoints_to_alarm = 1
  metric_name         = local.metric_transformation_name
  namespace           = local.metric_transformation_namespace
  unit                = "Count"
  period             = 60
  statistic          = "Sum"
  threshold          = 0
  treat_missing_data = "notBreaching"
  alarm_description  = "This metric monitors error logs in the Lambda function"
  alarm_actions      = [aws_sns_topic.alerts.arn]

  # dimensions = {
  #   FunctionName = var.lambda_name
  # }
}

# Explicit roles to allow logging for Lambda. Not strictly required here due to the full admin access
# granted in the lambda_admin_role_attach above. But added here to make it easier to fine-tune permissions
# in the above at a later point. 
resource "aws_iam_policy" "lambda_logging" {
  name        = "${var.lambda_name}-lambda-logging-role"
  path        = "/"
  description = "IAM policy for logging from a lambda"

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": [
        "arn:aws:logs:*:*:/aws/lambda/${var.lambda_name}",
        "arn:aws:logs:*:*:/aws/lambda/${var.lambda_name}:*"
      ],
      "Effect": "Allow"
    }
  ]
}
EOF
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_logging.arn
}
