resource "aws_iam_role" "worker_exec" {
  assume_role_policy = file("${path.module}/policies/lambda-assume.json")
  inline_policy {
    policy = data.aws_iam_policy_document.queue.json
  }
}
data "aws_iam_policy_document" "deploy" {
  statement {
    actions   = ["iam:PassRole"]
    resources = ["*"]
  }
}
data "aws_iam_policy_document" "queue" {
  statement {
    actions   = ["sqs:*"]
    resources = ["*"]
  }
}
resource "aws_iam_policy" "deploy" {
  policy = data.aws_iam_policy_document.deploy.json
}
resource "aws_iam_role_policy_attachment" "deploy" {
  role       = aws_iam_role.worker_exec.name
  policy_arn = aws_iam_policy.deploy.arn
}
