"""
Retirement.Simplified — API Lambda Handler
Handles Plans, Journal, Monte Carlo, and Profile CRUD operations.
Single-table DynamoDB design.

Table Schema:
  pk: USER#<userId>
  sk: PLAN#<planId> | JOURNAL#<date> | MONTECARLO#<timestamp> | PROFILE
"""

import json
import os
import uuid
import decimal
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key, Attr

TABLE_NAME = os.environ.get('TABLE_NAME', 'RetirementSimplified')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)


# ═══════════════════════════════════
# HELPERS
# ═══════════════════════════════════

class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, decimal.Decimal):
            return float(o)
        return super().default(o)


def get_user_id(event):
    """Extract user ID from Cognito authorizer claims."""
    try:
        claims = event['requestContext']['authorizer']['claims']
        return claims.get('sub') or claims.get('cognito:username')
    except (KeyError, TypeError):
        return None


def response(status_code, body=None, message=None):
    """Build API Gateway response."""
    payload = {}
    if body is not None:
        payload = body if isinstance(body, dict) else {'data': body}
    if message:
        payload['message'] = message
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        },
        'body': json.dumps(payload, cls=DecimalEncoder),
    }


def parse_body(event):
    """Parse JSON request body."""
    try:
        body = event.get('body', '{}')
        if isinstance(body, str):
            return json.loads(body, parse_float=decimal.Decimal)
        return body
    except (json.JSONDecodeError, TypeError):
        return {}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ═══════════════════════════════════
# PLANS HANDLER
# ═══════════════════════════════════

def plans_handler(event, context):
    """
    CRUD for retirement plans.
    
    Items stored as:
      pk: USER#<userId>
      sk: PLAN#<planId>
      data: {name, settings for each tab, createdAt, updatedAt}
    """
    user_id = get_user_id(event)
    if not user_id:
        return response(401, message='Unauthorized')

    method = event['httpMethod']
    pk = f'USER#{user_id}'

    # LIST all plans
    if method == 'GET' and not event.get('pathParameters'):
        result = table.query(
            KeyConditionExpression=Key('pk').eq(pk) & Key('sk').begins_with('PLAN#')
        )
        plans = []
        for item in result.get('Items', []):
            plan = item.get('data', {})
            plan['planId'] = item['sk'].replace('PLAN#', '')
            plans.append(plan)
        return response(200, {'plans': plans})

    # SAVE new plan
    if method == 'POST':
        body = parse_body(event)
        plan_id = str(uuid.uuid4())[:8]
        now = now_iso()
        
        item = {
            'pk': pk,
            'sk': f'PLAN#{plan_id}',
            'gsi1pk': f'USER#{user_id}',
            'gsi1sk': f'PLAN#{now}',
            'data': {
                'name': body.get('name', 'Untitled Plan'),
                'growth': body.get('growth', {}),
                'fees': body.get('fees', {}),
                'portfolio': body.get('portfolio', {}),
                'montecarlo': body.get('montecarlo', {}),
                'tax': body.get('tax', {}),
                'scenarios': body.get('scenarios', {}),
                'ssa': body.get('ssa', {}),
                'createdAt': now,
                'updatedAt': now,
            },
            'createdAt': now,
            'updatedAt': now,
        }
        table.put_item(Item=item)
        return response(201, {'planId': plan_id, 'message': 'Plan saved'})

    # UPDATE existing plan
    if method == 'PUT':
        plan_id = event.get('pathParameters', {}).get('planId')
        if not plan_id:
            return response(400, message='Plan ID required')
        
        body = parse_body(event)
        now = now_iso()
        
        # Get existing plan first
        existing = table.get_item(Key={'pk': pk, 'sk': f'PLAN#{plan_id}'})
        if 'Item' not in existing:
            return response(404, message='Plan not found')
        
        existing_data = existing['Item'].get('data', {})
        existing_data.update({k: v for k, v in body.items() if k != 'planId'})
        existing_data['updatedAt'] = now
        
        table.update_item(
            Key={'pk': pk, 'sk': f'PLAN#{plan_id}'},
            UpdateExpression='SET #data = :data, updatedAt = :now',
            ExpressionAttributeNames={'#data': 'data'},
            ExpressionAttributeValues={':data': existing_data, ':now': now},
        )
        return response(200, {'planId': plan_id, 'message': 'Plan updated'})

    # DELETE plan
    if method == 'DELETE':
        plan_id = event.get('pathParameters', {}).get('planId')
        if not plan_id:
            return response(400, message='Plan ID required')
        table.delete_item(Key={'pk': pk, 'sk': f'PLAN#{plan_id}'})
        return response(200, {'message': 'Plan deleted'})

    return response(400, message='Invalid request')


# ═══════════════════════════════════
# JOURNAL / PROGRESS TRACKING
# ═══════════════════════════════════

def journal_handler(event, context):
    """
    CRUD for progress journal entries.
    
    Items stored as:
      pk: USER#<userId>
      sk: JOURNAL#<YYYY-MM-DD>
      data: {date, totalSavings, totalInvested, netWorth, notes, accounts: [...]}
    """
    user_id = get_user_id(event)
    if not user_id:
        return response(401, message='Unauthorized')

    method = event['httpMethod']
    pk = f'USER#{user_id}'

    # LIST journal entries
    if method == 'GET':
        # Optional query params for date range
        params = event.get('queryStringParameters') or {}
        start_date = params.get('startDate', '2020-01-01')
        end_date = params.get('endDate', '2099-12-31')
        
        result = table.query(
            KeyConditionExpression=Key('pk').eq(pk) & Key('sk').between(
                f'JOURNAL#{start_date}', f'JOURNAL#{end_date}'
            )
        )
        entries = []
        for item in result.get('Items', []):
            entry = item.get('data', {})
            entry['date'] = item['sk'].replace('JOURNAL#', '')
            entries.append(entry)
        return response(200, {'entries': entries})

    # SAVE / UPDATE journal entry (upsert by date)
    if method == 'POST':
        body = parse_body(event)
        entry_date = body.get('date', datetime.now(timezone.utc).strftime('%Y-%m-%d'))
        now = now_iso()
        
        item = {
            'pk': pk,
            'sk': f'JOURNAL#{entry_date}',
            'gsi1pk': f'USER#{user_id}',
            'gsi1sk': f'JOURNAL#{entry_date}',
            'data': {
                'date': entry_date,
                'totalSavings': body.get('totalSavings', 0),
                'totalInvested': body.get('totalInvested', 0),
                'netWorth': body.get('netWorth', 0),
                'monthlyContributions': body.get('monthlyContributions', 0),
                'notes': body.get('notes', ''),
                'accounts': body.get('accounts', []),
                # accounts: [{name: '401k', balance: 50000, type: 'retirement'}, ...]
            },
            'createdAt': now,
            'updatedAt': now,
        }
        table.put_item(Item=item)
        return response(201, {'date': entry_date, 'message': 'Journal entry saved'})

    # DELETE journal entry
    if method == 'DELETE':
        entry_date = event.get('pathParameters', {}).get('entryDate')
        if not entry_date:
            return response(400, message='Entry date required')
        table.delete_item(Key={'pk': pk, 'sk': f'JOURNAL#{entry_date}'})
        return response(200, {'message': 'Journal entry deleted'})

    return response(400, message='Invalid request')


# ═══════════════════════════════════
# MONTE CARLO HISTORY
# ═══════════════════════════════════

def montecarlo_handler(event, context):
    """
    Save and retrieve Monte Carlo simulation results.
    
    Items stored as:
      pk: USER#<userId>
      sk: MONTECARLO#<timestamp>
      data: {planName, successRate, runs, params, percentiles_summary}
    """
    user_id = get_user_id(event)
    if not user_id:
        return response(401, message='Unauthorized')

    method = event['httpMethod']
    pk = f'USER#{user_id}'

    # LIST MC results (most recent first, limit 50)
    if method == 'GET':
        result = table.query(
            KeyConditionExpression=Key('pk').eq(pk) & Key('sk').begins_with('MONTECARLO#'),
            ScanIndexForward=False,
            Limit=50,
        )
        results = []
        for item in result.get('Items', []):
            entry = item.get('data', {})
            entry['timestamp'] = item['sk'].replace('MONTECARLO#', '')
            results.append(entry)
        return response(200, {'simulations': results})

    # SAVE MC result
    if method == 'POST':
        body = parse_body(event)
        now = now_iso()
        ts = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
        
        item = {
            'pk': pk,
            'sk': f'MONTECARLO#{ts}',
            'gsi1pk': f'USER#{user_id}',
            'gsi1sk': f'MONTECARLO#{ts}',
            'data': {
                'planName': body.get('planName', 'Unnamed'),
                'successRate': body.get('successRate', 0),
                'runs': body.get('runs', 1000),
                'params': body.get('params', {}),
                # params: {age, retireAge, savings, monthly, annualSpend}
                'medianAtRetirement': body.get('medianAtRetirement', 0),
                'medianAtEnd': body.get('medianAtEnd', 0),
                'p10AtEnd': body.get('p10AtEnd', 0),
                'p90AtEnd': body.get('p90AtEnd', 0),
            },
            'createdAt': now,
        }
        table.put_item(Item=item)
        return response(201, {'timestamp': ts, 'message': 'Simulation saved'})

    return response(400, message='Invalid request')


# ═══════════════════════════════════
# USER PROFILE
# ═══════════════════════════════════

def profile_handler(event, context):
    """
    Get/save user profile and default settings.
    
    Items stored as:
      pk: USER#<userId>
      sk: PROFILE
      data: {name, email, defaultSettings, theme, createdAt}
    """
    user_id = get_user_id(event)
    if not user_id:
        return response(401, message='Unauthorized')

    method = event['httpMethod']
    pk = f'USER#{user_id}'

    # GET profile
    if method == 'GET':
        result = table.get_item(Key={'pk': pk, 'sk': 'PROFILE'})
        if 'Item' in result:
            profile = result['Item'].get('data', {})
            profile['userId'] = user_id
            return response(200, {'profile': profile})
        else:
            # Return empty profile for new users
            claims = event['requestContext']['authorizer']['claims']
            return response(200, {'profile': {
                'userId': user_id,
                'name': claims.get('name', ''),
                'email': claims.get('email', ''),
                'isNew': True,
            }})

    # SAVE / UPDATE profile
    if method == 'POST':
        body = parse_body(event)
        now = now_iso()
        claims = event['requestContext']['authorizer']['claims']
        
        item = {
            'pk': pk,
            'sk': 'PROFILE',
            'gsi1pk': f'USER#{user_id}',
            'gsi1sk': 'PROFILE',
            'data': {
                'name': body.get('name', claims.get('name', '')),
                'email': claims.get('email', ''),
                'defaultSettings': body.get('defaultSettings', {}),
                'theme': body.get('theme', 'dark'),
                'createdAt': body.get('createdAt', now),
                'updatedAt': now,
            },
            'updatedAt': now,
        }
        table.put_item(Item=item)
        return response(200, {'message': 'Profile saved'})

    return response(400, message='Invalid request')
